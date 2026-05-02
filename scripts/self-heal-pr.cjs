#!/usr/bin/env node
/**
 * Self-heal PR generator (M5 Task 4 glue script).
 *
 * Inputs (env):
 *   INPUT_TEST_ID, INPUT_PAGE_OBJECT_FILE, INPUT_FAILING_SELECTOR,
 *   INPUT_PAGE_SOURCE_PATH (file path with XML), INPUT_ERROR_MESSAGE
 *   GH_TOKEN — for `gh pr create`
 *
 * Workflow:
 *   1. Load page source XML từ artifact path.
 *   2. Call suggester (lazy require ts-node compile suggester.ts).
 *   3. Nếu recommendation != null:
 *      - Edit Page Object file: replace failing selector with new selector.
 *      - Create branch self-heal/{testId-hash}.
 *      - Commit + push + open PR.
 *   4. Nếu suggestions empty → log + exit 0 (no-op).
 *
 * Failure modes (graceful):
 *   - LLM unreachable → log warn, exit 0 (CI workflow sẽ note).
 *   - Budget exceeded → log warn, exit 0.
 *   - Page Object file missing failingSelector literal → log + exit 0
 *     (manual edit required — automation chỉ help simple text replace).
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execSync } = require('node:child_process');

const REQUIRED_ENV = [
  'INPUT_TEST_ID',
  'INPUT_PAGE_OBJECT_FILE',
  'INPUT_FAILING_SELECTOR',
  'INPUT_PAGE_SOURCE_PATH',
  'INPUT_ERROR_MESSAGE',
];

function log(msg, ctx) {
  const ts = new Date().toISOString();
  const ctxStr = ctx ? ` ${JSON.stringify(ctx)}` : '';
  console.log(`[${ts}] [self-heal-pr] ${msg}${ctxStr}`);
}

function fatal(msg, e) {
  log(`FATAL: ${msg}`, e ? { error: e.message } : undefined);
  process.exit(1);
}

function checkEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) fatal(`Missing env: ${missing.join(', ')}`);
}

function loadPageSource() {
  const p = process.env.INPUT_PAGE_SOURCE_PATH;
  if (!fs.existsSync(p)) fatal(`page source missing: ${p}`);
  return fs.readFileSync(p, 'utf8');
}

function shortHash(s) {
  return crypto.createHash('sha1').update(s).digest('hex').slice(0, 8);
}

function runShell(cmd) {
  log('exec', { cmd });
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

async function main() {
  checkEnv();

  const input = {
    testId: process.env.INPUT_TEST_ID,
    pageObjectFile: process.env.INPUT_PAGE_OBJECT_FILE,
    failingSelector: process.env.INPUT_FAILING_SELECTOR,
    pageSourceSnippet: loadPageSource(),
    errorMessage: process.env.INPUT_ERROR_MESSAGE,
  };

  // Lazy require — TS compile via ts-node (M5 acceptance Task 12 sẽ compile
  // dist/ trước khi chạy script).
  require('ts-node/register');
  const { suggestLocators } = require(path.resolve('./src/utils/selfHeal/suggester.ts'));
  const { LlmBudgetTracker } = require(path.resolve('./src/utils/llm/budget.ts'));
  const { createLlmAdapter } = require(path.resolve('./src/utils/llm/factory.ts'));
  const { loadEnv } = require(path.resolve('./src/config/index.ts'));

  const env = loadEnv();
  if (env.LLM_PROVIDER === 'none') {
    log('LLM_PROVIDER=none — self-heal disabled, exit no-op');
    return;
  }

  const adapter = createLlmAdapter(env);
  const tracker = new LlmBudgetTracker({
    statePath: env.LLM_SPEND_STATE_PATH,
    budgetMonthlyUsd: env.LLM_BUDGET_MONTHLY_USD,
  });

  let result;
  try {
    result = await suggestLocators(input, { adapter, tracker });
  } catch (e) {
    log('suggester error → graceful skip', { error: e.message });
    return;
  }

  if (!result.recommendation) {
    log('no recommendation — exit no-op');
    return;
  }

  const pageObjectPath = path.resolve(input.pageObjectFile);
  if (!fs.existsSync(pageObjectPath)) fatal(`page object missing: ${pageObjectPath}`);

  const original = fs.readFileSync(pageObjectPath, 'utf8');
  if (!original.includes(input.failingSelector)) {
    log('failing selector literal not found in Page Object — manual edit required', {
      pageObjectPath,
      failingSelector: input.failingSelector,
    });
    return;
  }

  const updated = original.split(input.failingSelector).join(result.recommendation.newSelector);
  fs.writeFileSync(pageObjectPath, updated);

  const branch = `self-heal/${shortHash(input.testId)}-${Date.now()}`;
  runShell(`git checkout -b ${branch}`);
  runShell(`git add ${input.pageObjectFile}`);
  runShell(
    `git commit -m "fix(self-heal): suggest ${result.recommendation.newSelector} for ${input.testId}"`,
  );
  runShell(`git push -u origin ${branch}`);

  const top3 = result.suggestions
    .map(
      (s, i) =>
        `${i + 1}. \`${s.newSelector}\` (${s.selectorType}, conf ${s.confidence.toFixed(2)}) — ${s.reasoning}`,
    )
    .join('\n');
  const body = [
    `## Self-heal locator suggestion`,
    '',
    `**Test:** \`${input.testId}\``,
    `**Page Object:** \`${input.pageObjectFile}\``,
    `**Failing selector:** \`${input.failingSelector}\``,
    '',
    `### Top-3 suggestions`,
    top3,
    '',
    `**Applied:** \`${result.recommendation.newSelector}\` (top confidence).`,
    '',
    '⚠️ **Human review required** — branch protection blocks auto-merge per spec §7.8.',
    '',
    `Generated by \`scripts/self-heal-pr.cjs\` (M5 Task 4) · cost $${result.costUsd.toFixed(4)}.`,
  ].join('\n');
  runShell(
    `gh pr create --base main --head ${branch} --title "[self-heal] ${path.basename(input.pageObjectFile)} locator drift" --body ${JSON.stringify(body)}`,
  );
  log('PR opened', { branch });
}

main().catch((e) => fatal('unhandled', e));
