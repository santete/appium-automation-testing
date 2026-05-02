#!/usr/bin/env node
/**
 * Regression risk score — M6 Task 7.
 *
 * Top-3 test với risk score cao nhất, theo công thức:
 *   risk_score = churn_score * 0.5 + (1 - pass_rate) * 0.5
 *
 * - churn_score: số commit chạm test file trong 30d (normalized 0..1).
 * - pass_rate: từ InfluxDB 30d (default 1.0 nếu missing → low risk).
 *
 * Use: trước release, dev biết test nào nên review kỹ thêm.
 *
 * Output: console + reports/analytics/regression-risk.json.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const url = process.env.INFLUX_URL;
const token = process.env.INFLUX_TOKEN;
const org = process.env.INFLUX_ORG;
const bucket = process.env.INFLUX_BUCKET;

function gitChurn() {
  // Count commits per test file in last 30d.
  const out = execSync(
    'git log --since="30 days ago" --name-only --pretty=format: -- tests/',
    { encoding: 'utf8' },
  );
  const map = {};
  for (const line of out.split('\n')) {
    const f = line.trim();
    if (!f || !f.match(/\.spec\.ts$/)) continue;
    map[f] = (map[f] || 0) + 1;
  }
  return map;
}

async function flux(query) {
  if (!url || !token || !org || !bucket) return null;
  const res = await fetch(`${url}/api/v2/query?org=${encodeURIComponent(org)}`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${token}`,
      'Content-Type': 'application/vnd.flux',
      Accept: 'application/csv',
    },
    body: query,
  });
  if (!res.ok) return null;
  return res.text();
}

function parseTestPassRates(csv) {
  if (!csv) return {};
  const lines = csv.split('\n').filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) return {};
  const header = lines[0].split(',');
  const idIdx = header.indexOf('test_id');
  const vIdx = header.indexOf('_value');
  const map = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const id = cols[idIdx];
    const v = parseFloat(cols[vIdx]);
    if (id && Number.isFinite(v)) map[id] = v;
  }
  return map;
}

(async () => {
  const churn = gitChurn();
  const churnFiles = Object.keys(churn);
  if (churnFiles.length === 0) {
    console.log('[regression-risk] no test churn in last 30d → all tests low risk.');
    process.exit(0);
  }
  const maxChurn = Math.max(...Object.values(churn));

  const passQ = `from(bucket: "${bucket}")
  |> range(start: -30d)
  |> filter(fn: (r) => r._measurement == "test_run" and r._field == "status")
  |> group(columns: ["test_id"])
  |> mean()`;
  const passRates = parseTestPassRates(await flux(passQ));

  const scored = churnFiles.map((file) => {
    const churnScore = churn[file] / maxChurn;
    // Match test_id by basename (heuristic — matches `describe()` block name convention).
    const basename = path.basename(file, '.spec.ts');
    const matchedId = Object.keys(passRates).find((id) =>
      id.toLowerCase().includes(basename.toLowerCase()),
    );
    const passRate = matchedId ? passRates[matchedId] : 1.0;
    const failRate = 1 - passRate;
    const risk = churnScore * 0.5 + failRate * 0.5;
    return {
      file,
      churn_count: churn[file],
      churn_score: parseFloat(churnScore.toFixed(3)),
      pass_rate: parseFloat(passRate.toFixed(4)),
      risk_score: parseFloat(risk.toFixed(3)),
    };
  });
  scored.sort((a, b) => b.risk_score - a.risk_score);
  const top3 = scored.slice(0, 3);

  console.log('========== TOP 3 REGRESSION RISK TESTS ==========');
  for (const r of top3) {
    console.log(`  risk=${r.risk_score}  churn=${r.churn_count}  pass_rate=${r.pass_rate}  ${r.file}`);
  }

  const outDir = path.resolve(__dirname, '..', 'reports', 'analytics');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'regression-risk.json');
  fs.writeFileSync(
    outPath,
    JSON.stringify({ generated_at: new Date().toISOString(), top3, all: scored }, null, 2),
  );
  console.log(`\n  Report → ${outPath}`);
})().catch((e) => {
  console.error('[regression-risk] FATAL:', e.message);
  process.exit(1);
});
