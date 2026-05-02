#!/usr/bin/env node
/**
 * KPI window gate — M6 Task 6 (Decision 5 Hybrid).
 *
 * Reads InfluxDB 14-day window, asserts 4 critical KPI:
 *   1. Genuine pass rate >= 0.95
 *   2. Flaky rate < 0.03
 *   3. False-positive rate < 0.01
 *   4. PR pipeline P95 duration < 600s (10 min)
 *
 * Exit code: 0 pass | 1 hard fail | 2 soft warn (data sparse <3 days).
 *
 * Hybrid mode: 3 manual KPI (coverage, MTTD, MTTF) NOT gated here — Phuc reads
 * dashboard m6-kpi-sustained weekly.
 *
 * Env required:
 *   INFLUX_URL, INFLUX_TOKEN, INFLUX_ORG, INFLUX_BUCKET
 *
 * CI wire: regression.yml + nightly. Optional `KPI_WINDOW_DAYS` override (default 14).
 * `--soft` flag = warn-only (exit 0 always); for first 14d after enabling.
 */
'use strict';

const url = process.env.INFLUX_URL;
const token = process.env.INFLUX_TOKEN;
const org = process.env.INFLUX_ORG;
const bucket = process.env.INFLUX_BUCKET;
const windowDays = parseInt(process.env.KPI_WINDOW_DAYS || '14', 10);
const branch = process.env.KPI_BRANCH || 'main';
const soft = process.argv.includes('--soft');

if (!url || !token || !org || !bucket) {
  console.error('[kpi-gate] missing INFLUX_URL/TOKEN/ORG/BUCKET — skip (no-op).');
  process.exit(0);
}

const TARGETS = {
  pass_rate: { min: 0.95, label: 'genuine pass rate' },
  flaky_rate: { max: 0.03, label: 'flaky rate' },
  false_positive_rate: { max: 0.01, label: 'false-positive rate' },
  pipeline_p95_pr_seconds: { max: 600, label: 'PR pipeline P95 duration' },
};

async function flux(query) {
  const res = await fetch(`${url}/api/v2/query?org=${encodeURIComponent(org)}`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${token}`,
      'Content-Type': 'application/vnd.flux',
      Accept: 'application/csv',
    },
    body: query,
  });
  if (!res.ok) {
    throw new Error(`Flux query HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return res.text();
}

function parseCsvSingleValue(csv) {
  const lines = csv.split('\n').filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) return null;
  const header = lines[0].split(',');
  const valueIdx = header.indexOf('_value');
  if (valueIdx === -1) return null;
  const row = lines[1].split(',');
  const v = parseFloat(row[valueIdx]);
  return Number.isFinite(v) ? v : null;
}

async function queryPassRate() {
  const q = `from(bucket: "${bucket}")
  |> range(start: -${windowDays}d)
  |> filter(fn: (r) => r._measurement == "test_run" and r._field == "status" and r.branch == "${branch}")
  |> mean()`;
  return parseCsvSingleValue(await flux(q));
}

async function queryFlakyRate() {
  const q = `from(bucket: "${bucket}")
  |> range(start: -${windowDays}d)
  |> filter(fn: (r) => r._measurement == "flaky_verdict" and r._field == "should_quarantine")
  |> mean()`;
  return parseCsvSingleValue(await flux(q));
}

async function queryFalsePositiveRate() {
  const q = `from(bucket: "${bucket}")
  |> range(start: -${windowDays}d)
  |> filter(fn: (r) => r._measurement == "test_run" and r._field == "category")
  |> map(fn: (r) => ({ r with _value: if r._value == "false_positive" then 1.0 else 0.0 }))
  |> mean()`;
  return parseCsvSingleValue(await flux(q));
}

async function queryPrPipelineP95() {
  const q = `from(bucket: "${bucket}")
  |> range(start: -${windowDays}d)
  |> filter(fn: (r) => r._measurement == "pipeline_duration" and r._field == "duration_seconds" and r.workflow == "ci.yml")
  |> quantile(q: 0.95)`;
  return parseCsvSingleValue(await flux(q));
}

async function queryDataPointCount() {
  const q = `from(bucket: "${bucket}")
  |> range(start: -${windowDays}d)
  |> filter(fn: (r) => r._measurement == "test_run" and r._field == "status")
  |> count()`;
  return parseCsvSingleValue(await flux(q));
}

(async () => {
  console.log(`[kpi-gate] window=${windowDays}d branch=${branch} mode=${soft ? 'SOFT' : 'HARD'}`);

  const points = await queryDataPointCount();
  if (points === null || points < 50) {
    console.warn(
      `[kpi-gate] data sparse (points=${points ?? 0}) — need >= 50 datapoints for reliable verdict. Skipping gate.`,
    );
    process.exit(soft ? 0 : 2);
  }
  console.log(`[kpi-gate] data points in window: ${points}`);

  const results = [];
  const checks = [
    { key: 'pass_rate', getter: queryPassRate },
    { key: 'flaky_rate', getter: queryFlakyRate },
    { key: 'false_positive_rate', getter: queryFalsePositiveRate },
    { key: 'pipeline_p95_pr_seconds', getter: queryPrPipelineP95 },
  ];

  for (const c of checks) {
    try {
      const value = await c.getter();
      const target = TARGETS[c.key];
      let pass;
      let cmp;
      if (target.min !== undefined) {
        pass = value !== null && value >= target.min;
        cmp = `>= ${target.min}`;
      } else {
        pass = value !== null && value < target.max;
        cmp = `< ${target.max}`;
      }
      results.push({ key: c.key, label: target.label, value, cmp, pass });
    } catch (e) {
      results.push({ key: c.key, label: TARGETS[c.key].label, value: null, cmp: '', pass: false, err: e.message });
    }
  }

  console.log('\n========== KPI WINDOW GATE ==========');
  for (const r of results) {
    const status = r.pass ? 'PASS' : 'FAIL';
    const v = r.value === null ? 'N/A' : typeof r.value === 'number' ? r.value.toFixed(4) : r.value;
    console.log(`  [${status}] ${r.label.padEnd(32)} actual=${v.toString().padEnd(10)} target ${r.cmp}${r.err ? ` (err: ${r.err})` : ''}`);
  }

  const failed = results.filter((r) => !r.pass);
  if (failed.length > 0) {
    console.error(`\n[kpi-gate] ${failed.length}/${results.length} KPI miss target.`);
    if (soft) {
      console.warn('[kpi-gate] SOFT mode → exit 0 (warn only).');
      process.exit(0);
    }
    process.exit(1);
  }
  console.log(`\n[kpi-gate] All 4 critical KPI green for ${windowDays}d window.`);
  process.exit(0);
})().catch((e) => {
  console.error('[kpi-gate] FATAL:', e.message);
  process.exit(soft ? 0 : 1);
});
