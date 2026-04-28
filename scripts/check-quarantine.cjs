/**
 * Quarantine deadline check — CI gate.
 *
 * Plan ref: M4 Task 9.
 *
 * Mục tiêu (từ comment header `docs/quarantine.yaml`):
 *   - Validate YAML schema (Zod refinement: deadline ≥ added, deadline ≤ added + 21).
 *   - Verify mọi entry deadline > today (UTC) — past-deadline → CI fail buộc fix
 *     hoặc extend grace ≤ 21 ngày qua PR review.
 *
 * Usage:
 *   node scripts/check-quarantine.cjs
 *
 * Exit code:
 *   0 = PASS (schema valid + 0 past-deadline entries)
 *   1 = FAIL (schema invalid HOẶC ≥ 1 past-deadline entry)
 *
 * Reuse `loadQuarantine` từ `src/utils/quarantine/loader.ts` qua ts-node/register
 * → single source of truth (không duplicate schema validation logic).
 *
 * `transpile-only` skip type-check vì CI đã chạy `npm run typecheck` riêng trước
 * step này → tiết kiệm ~2s boot.
 */
require('ts-node/register/transpile-only');
const path = require('node:path');
const {
  loadQuarantine,
  isPastDeadline,
} = require('../src/utils/quarantine/loader');

const QUARANTINE_FILE = path.resolve(__dirname, '..', 'docs', 'quarantine.yaml');

let file;
try {
  file = loadQuarantine(QUARANTINE_FILE);
} catch (err) {
  console.error(`[FAIL] Quarantine schema invalid:\n${err.message}`);
  process.exit(1);
}

const past = file.entries.filter((e) => isPastDeadline(e));
const active = file.entries.filter((e) => !isPastDeadline(e));

console.log(
  `Quarantine: ${file.entries.length} entries total — ${active.length} active, ${past.length} past-deadline.`,
);

if (past.length > 0) {
  console.error('\n[FAIL] Past-deadline entries — fix test hoặc extend grace ≤ 21 ngày:');
  for (const e of past) {
    console.error(`  - test_id: ${e.test_id}`);
    console.error(`    deadline: ${e.deadline} (added: ${e.added}, owner: ${e.owner})`);
    console.error(`    reason: ${e.reason}`);
  }
  process.exit(1);
}

if (active.length > 0) {
  console.log('\n[INFO] Active quarantine (đang skip cho đến deadline):');
  for (const e of active) {
    console.log(`  - ${e.test_id} (deadline: ${e.deadline}, owner: ${e.owner})`);
  }
}

console.log('\n[PASS] Quarantine schema valid + 0 entries past deadline.');
process.exit(0);
