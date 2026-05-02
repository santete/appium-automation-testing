#!/usr/bin/env node
/**
 * Auto-quarantine PR generator (M5 Task 3).
 *
 * Workflow:
 *   1. Read test run history JSON (from CI artifact) → array of TestRunRecord.
 *   2. Run flaky detector → verdicts.
 *   3. For each shouldQuarantine === true AND not yet in quarantine.yaml:
 *      - Append YAML entry với deadline = today + 14 days.
 *   4. If any new entries: create branch, commit, open PR via `gh pr create`.
 *      KHÔNG auto-merge — branch protection block (spec §7.8).
 *
 * Inputs (env):
 *   HISTORY_JSON_PATH  — required path to history JSON (default: ./tmp/test-history.json)
 *   QUARANTINE_PATH    — default: ./docs/quarantine.yaml
 *   QUARANTINE_DAYS    — default: 14 (deadline grace per M4 schema)
 *   DRY_RUN            — '1' → don't run gh, only log
 *   GIT_USER_EMAIL/NAME — required for commit (CI runner sets it)
 *
 * Exit codes:
 *   0 — success (PR opened or no-op)
 *   1 — fatal error
 */
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const yaml = require('js-yaml');

const HISTORY_PATH = process.env.HISTORY_JSON_PATH || './tmp/test-history.json';
const QUARANTINE_PATH = process.env.QUARANTINE_PATH || './docs/quarantine.yaml';
const QUARANTINE_DAYS = parseInt(process.env.QUARANTINE_DAYS || '14', 10);
const DRY_RUN = process.env.DRY_RUN === '1';

function log(msg, ctx) {
  const ts = new Date().toISOString();
  const ctxStr = ctx ? ` ${JSON.stringify(ctx)}` : '';
  console.log(`[${ts}] [auto-quarantine-pr] ${msg}${ctxStr}`);
}

function fatal(msg, e) {
  log(`FATAL: ${msg}`, e ? { error: e.message } : undefined);
  process.exit(1);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function loadHistory() {
  if (!fs.existsSync(HISTORY_PATH)) {
    fatal(`History file missing: ${HISTORY_PATH}`);
  }
  try {
    return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
  } catch (e) {
    fatal('History JSON malformed', e);
  }
}

function loadQuarantineEntries() {
  if (!fs.existsSync(QUARANTINE_PATH)) return [];
  const raw = fs.readFileSync(QUARANTINE_PATH, 'utf8');
  const parsed = yaml.load(raw);
  if (!parsed || !Array.isArray(parsed.entries)) return [];
  return parsed.entries;
}

function detectFromHistory(history) {
  const detector = require(path.resolve('./src/utils/flaky/detector.ts'));
  return detector.detectFlakyAll(history);
}

function appendEntries(existing, newEntries) {
  const existingIds = new Set(existing.map((e) => e.test_id));
  const fresh = newEntries.filter((n) => !existingIds.has(n.test_id));
  if (fresh.length === 0) return { entries: existing, added: 0 };
  const combined = { entries: [...existing, ...fresh] };
  fs.writeFileSync(QUARANTINE_PATH, yaml.dump(combined, { lineWidth: 100 }));
  return { entries: combined.entries, added: fresh.length };
}

function makeEntry(verdict) {
  return {
    test_id: verdict.testId,
    reason: `Auto-quarantine — ${verdict.reason} See M5 flaky detector audit.`,
    added: todayIso(),
    deadline: addDays(todayIso(), QUARANTINE_DAYS),
    owner: process.env.GIT_USER_EMAIL || 'qa-bot@unknown',
  };
}

function runShell(cmd, opts = {}) {
  log('exec', { cmd });
  if (DRY_RUN) return '';
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
}

function main() {
  log('start', { HISTORY_PATH, QUARANTINE_PATH, DRY_RUN });
  const history = loadHistory();
  log('loaded history', { records: history.length });

  // Note: detector imports TS via ts-node — for CJS script context user must
  // run via `npx ts-node-paths` or pre-compile. M5 acceptance Task 12 will
  // wrap this with CI-safe runner. For now, prefer compiled JS path nếu có.
  const compiledPath = path.resolve('./dist/utils/flaky/detector.js');
  let detector;
  if (fs.existsSync(compiledPath)) {
    detector = require(compiledPath);
  } else {
    // Lazy require ts-node để CJS script chạy TS source (acceptable cho M5
    // smoke; production sẽ compile + ship JS).
    require('ts-node/register');
    detector = require(path.resolve('./src/utils/flaky/detector.ts'));
  }
  const verdicts = detector.detectFlakyAll(history);
  const flaky = verdicts.filter((v) => v.shouldQuarantine);
  log('detector verdicts', {
    total: verdicts.length,
    flaky: flaky.length,
  });

  if (flaky.length === 0) {
    log('no new flaky tests detected — exit clean');
    return;
  }

  const existing = loadQuarantineEntries();
  const newEntries = flaky.map(makeEntry);
  const { added } = appendEntries(existing, newEntries);
  log('quarantine.yaml updated', { newlyAdded: added });

  if (added === 0) {
    log('all flaky tests already quarantined — no PR needed');
    return;
  }

  if (DRY_RUN) {
    log('DRY_RUN — skip git/gh');
    return;
  }

  const branch = `auto-quarantine/${todayIso()}-${Date.now()}`;
  runShell(`git checkout -b ${branch}`);
  runShell(`git add ${QUARANTINE_PATH}`);
  runShell(
    `git commit -m "test(quarantine): auto-add ${added} flaky test(s) — M5 detector"`,
  );
  runShell(`git push -u origin ${branch}`);
  const body = [
    '## Auto-quarantine PR',
    '',
    `Detector found ${added} new flaky test(s):`,
    '',
    ...flaky.map((v) => `- \`${v.testId}\` — ${v.reason}`),
    '',
    `Deadline: ${addDays(todayIso(), QUARANTINE_DAYS)} (${QUARANTINE_DAYS}d).`,
    '',
    '**Action required:** RCA + fix before deadline; otherwise CI fails.',
    '',
    'Generated by `scripts/auto-quarantine-pr.cjs` (M5 Task 3).',
  ].join('\n');
  runShell(
    `gh pr create --base main --head ${branch} --title "test(quarantine): auto-add ${added} flaky test(s)" --body ${JSON.stringify(body)}`,
  );
  log('PR opened', { branch });
}

try {
  main();
} catch (e) {
  fatal('unhandled error', e);
}
