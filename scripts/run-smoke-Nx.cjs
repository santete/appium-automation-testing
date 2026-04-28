/**
 * Run smoke suite N lần liên tục, log kết quả mỗi run, fail-fast nếu 1 run fail.
 *
 * Plan ref: M3 Task 22 + 24, Acceptance §2.2 (20x smoke pass).
 *
 * Usage: node scripts/run-smoke-Nx.cjs <N>
 *
 * Output:
 *   - Stdout: per-run status + duration
 *   - Exit 0 nếu N/N pass
 *   - Exit 1 + error message nếu run nào fail (stop ở run đầu tiên fail)
 *   - Allure results accumulate trong reports/allure-results/ — mỗi run reset
 *     trước khi start để tránh stale verdict.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const N = Number(process.argv[2] ?? 20);
if (!Number.isFinite(N) || N <= 0) {
  console.error(`Invalid N: ${process.argv[2]}`);
  process.exit(2);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const ALLURE_DIR = path.resolve(REPO_ROOT, 'reports', 'allure-results');

function clearAllure() {
  if (fs.existsSync(ALLURE_DIR)) {
    fs.rmSync(ALLURE_DIR, { recursive: true, force: true });
  }
}

function runOnce(idx) {
  const t0 = Date.now();
  const result = spawnSync('npm', ['run', 'test:smoke'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    shell: true,
  });
  const ms = Date.now() - t0;
  return { idx, ok: result.status === 0, ms, exitCode: result.status };
}

const startTs = new Date().toISOString();
console.log(`[smoke ${N}x] start at ${startTs}`);

const summary = [];
for (let i = 1; i <= N; i++) {
  console.log(`\n──────── Run ${i}/${N} ────────`);
  clearAllure();
  const r = runOnce(i);
  summary.push(r);
  console.log(`[smoke ${N}x] run ${i} → ${r.ok ? 'PASS' : 'FAIL'} (${r.ms}ms, exit ${r.exitCode})`);
  if (!r.ok) {
    console.error(`[smoke ${N}x] STOP — run ${i} failed`);
    console.table(summary);
    process.exit(1);
  }
}

console.log(`\n[smoke ${N}x] complete: ${summary.filter((r) => r.ok).length}/${N} PASS`);
console.table(summary);
process.exit(0);
