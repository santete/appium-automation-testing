#!/usr/bin/env node
/**
 * Maintenance cost tracker — M6 Task 7 (Decision 6).
 *
 * Parses git log for `fix(flaky):` convention commits in last 30d (configurable
 * via MAINT_WINDOW_DAYS). Estimates 1h per commit (Phuc default — override per-
 * commit via tmp/m6-maintenance-overrides.json `{ "<sha>": <hours> }`).
 *
 * Output:
 *   - console summary
 *   - reports/analytics/maintenance-cost.json
 *
 * Decision 6 rationale: zero new tooling; commit message is single source of
 * truth. Manual override JSON for big fixes (>4h) by Phuc.
 *
 * Run weekly. Output feeds Grafana panel + ROI report Task 9.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const windowDays = parseInt(process.env.MAINT_WINDOW_DAYS || '30', 10);
const overridesPath = path.resolve(__dirname, '..', 'tmp', 'm6-maintenance-overrides.json');
const defaultHoursPerCommit = parseFloat(process.env.MAINT_DEFAULT_HOURS || '1');

let overrides = {};
if (fs.existsSync(overridesPath)) {
  try {
    overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
  } catch (e) {
    console.warn(`[maintenance-cost] override file invalid JSON, ignoring: ${e.message}`);
  }
}

const out = execSync(
  `git log --since="${windowDays} days ago" --pretty=format:"%H||%s||%an||%ai" --grep="fix(flaky)"`,
  { encoding: 'utf8' },
);

const lines = out.split('\n').filter((l) => l.trim());
const commits = lines.map((line) => {
  const [sha, subject, author, date] = line.split('||');
  const testIdMatch = subject.match(/fix\(flaky\):\s*([^\s]+)/);
  const testId = testIdMatch ? testIdMatch[1] : null;
  const hours = overrides[sha] !== undefined ? overrides[sha] : defaultHoursPerCommit;
  return { sha: sha.slice(0, 8), subject, author, date, test_id: testId, hours };
});

const totalHours = commits.reduce((sum, c) => sum + c.hours, 0);
const missingTestId = commits.filter((c) => !c.test_id);

console.log('========== MAINTENANCE COST TRACKER ==========');
console.log(`  Window: ${windowDays}d | commits matched: ${commits.length} | total hours: ${totalHours}`);
if (missingTestId.length > 0) {
  console.warn(`  ⚠ ${missingTestId.length} commit(s) match pattern but missing <test_id> after 'fix(flaky):':`);
  for (const c of missingTestId) {
    console.warn(`     ${c.sha} ${c.subject}`);
  }
}
console.log('\n  Per-commit:');
for (const c of commits) {
  const ovr = overrides[c.sha] !== undefined ? ' [OVERRIDE]' : '';
  console.log(`    ${c.sha} ${c.date.slice(0, 10)} ${c.author.padEnd(15)} ${c.hours}h${ovr}  ${c.subject}`);
}

const report = {
  generated_at: new Date().toISOString(),
  window_days: windowDays,
  default_hours_per_commit: defaultHoursPerCommit,
  total_hours: totalHours,
  commit_count: commits.length,
  missing_test_id_count: missingTestId.length,
  commits,
};
const outDir = path.resolve(__dirname, '..', 'reports', 'analytics');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'maintenance-cost.json');
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(`\n  Report → ${outPath}`);
