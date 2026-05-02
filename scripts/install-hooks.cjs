#!/usr/bin/env node
/**
 * Install git hooks from `.husky/` into `.git/hooks/` (zero-dep alternative
 * to `husky install`).
 *
 * D16 / M7 Task 12 — `fix(flaky|locator|env):` commit convention enforcement.
 *
 * Usage:
 *   - `npm run prepare` (auto via package.json `scripts.prepare` after `npm ci`).
 *   - `node scripts/install-hooks.cjs` manual.
 *
 * Skips silently if:
 *   - `.git/` không tồn tại (CI checkout shallow OR worktree clone).
 *   - `.husky/` không tồn tại (fresh clone trước khi commit hook ship).
 *
 * Each hook in `.husky/` (vd. `commit-msg`) → installed as
 * `.git/hooks/<hook-name>` thin wrapper that exec hook trong `.husky/`.
 * This pattern matches `husky` v9 behavior — git always reads `.git/hooks/`,
 * wrapper points back to versioned `.husky/`.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const HUSKY_DIR = path.join(ROOT, '.husky');
const GIT_DIR = path.join(ROOT, '.git');

function log(msg) {
  console.log(`[install-hooks] ${msg}`);
}

if (!fs.existsSync(GIT_DIR)) {
  log('.git/ not found — skip (CI checkout or non-git workspace)');
  process.exit(0);
}

if (!fs.existsSync(HUSKY_DIR)) {
  log('.husky/ not found — skip');
  process.exit(0);
}

const hooksDir = path.join(GIT_DIR, 'hooks');
fs.mkdirSync(hooksDir, { recursive: true });

const huskyEntries = fs.readdirSync(HUSKY_DIR).filter((name) => {
  const full = path.join(HUSKY_DIR, name);
  return fs.statSync(full).isFile() && !name.startsWith('.');
});

for (const hookName of huskyEntries) {
  const target = path.join(hooksDir, hookName);
  const wrapper = `#!/usr/bin/env bash\n. "$(dirname -- "$0")/../../.husky/${hookName}"\n`;
  fs.writeFileSync(target, wrapper, { mode: 0o755 });
  log(`installed ${hookName} → .git/hooks/${hookName}`);
}

if (huskyEntries.length === 0) {
  log('no hooks in .husky/ to install');
}
