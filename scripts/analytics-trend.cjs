#!/usr/bin/env node
/**
 * Pass-rate trend forecast — M6 Task 7.
 *
 * Reads InfluxDB last 30 days daily pass rate, fits linear regression,
 * extrapolates 7 days forward.
 *
 * Output: console table + writes `reports/analytics/pass-rate-forecast.json`.
 *
 * Use: weekly review by Phuc — "if trend continues, will we still hit 95%
 * sustain target next week?"
 *
 * No InfluxDB env → no-op exit 0.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const url = process.env.INFLUX_URL;
const token = process.env.INFLUX_TOKEN;
const org = process.env.INFLUX_ORG;
const bucket = process.env.INFLUX_BUCKET;
const branch = process.env.KPI_BRANCH || 'main';

if (!url || !token || !org || !bucket) {
  console.error('[analytics-trend] missing INFLUX env — no-op.');
  process.exit(0);
}

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
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.text();
}

function parseDailySeries(csv) {
  const lines = csv.split('\n').filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) return [];
  const header = lines[0].split(',');
  const tIdx = header.indexOf('_time');
  const vIdx = header.indexOf('_value');
  return lines
    .slice(1)
    .map((row) => {
      const cols = row.split(',');
      return { time: cols[tIdx], value: parseFloat(cols[vIdx]) };
    })
    .filter((p) => Number.isFinite(p.value));
}

function linearRegression(points) {
  const n = points.length;
  if (n < 2) return null;
  const xs = points.map((_, i) => i);
  const ys = points.map((p) => p.value);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  if (den === 0) return { slope: 0, intercept: meanY };
  return { slope: num / den, intercept: meanY - (num / den) * meanX };
}

(async () => {
  const q = `from(bucket: "${bucket}")
  |> range(start: -30d)
  |> filter(fn: (r) => r._measurement == "test_run" and r._field == "status" and r.branch == "${branch}")
  |> aggregateWindow(every: 1d, fn: mean)
  |> yield(name: "daily_pass_rate")`;

  const series = parseDailySeries(await flux(q));
  if (series.length < 7) {
    console.warn(`[analytics-trend] need >= 7 days of data, got ${series.length}. Aborting.`);
    process.exit(0);
  }

  const fit = linearRegression(series);
  const lastIdx = series.length - 1;
  const forecast = [];
  for (let day = 1; day <= 7; day++) {
    const x = lastIdx + day;
    const y = Math.max(0, Math.min(1, fit.intercept + fit.slope * x));
    const date = new Date(Date.now() + day * 86400000).toISOString().slice(0, 10);
    forecast.push({ date, predicted_pass_rate: parseFloat(y.toFixed(4)) });
  }

  console.log('========== PASS RATE TREND FORECAST ==========');
  console.log(
    `  Window: 30d | data points: ${series.length} | slope: ${fit.slope.toFixed(5)}/day | intercept: ${fit.intercept.toFixed(4)}`,
  );
  console.log(
    `  Last actual (${series[lastIdx].time.slice(0, 10)}): ${series[lastIdx].value.toFixed(4)}`,
  );
  console.log('\n  Forecast next 7 days:');
  for (const f of forecast) {
    const flag = f.predicted_pass_rate >= 0.95 ? 'OK' : 'AT RISK';
    console.log(`    ${f.date}  pass_rate=${f.predicted_pass_rate}  [${flag}]`);
  }

  const report = {
    generated_at: new Date().toISOString(),
    window_days: 30,
    branch,
    slope_per_day: fit.slope,
    intercept: fit.intercept,
    last_actual: series[lastIdx],
    forecast,
  };
  const outDir = path.resolve(__dirname, '..', 'reports', 'analytics');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'pass-rate-forecast.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\n  Report → ${outPath}`);
})().catch((e) => {
  console.error('[analytics-trend] FATAL:', e.message);
  process.exit(1);
});
