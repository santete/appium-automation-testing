#!/usr/bin/env node
/**
 * Detect newly added spec files in current PR (D12 / M7 Task 5).
 *
 * Spec §6.4 yêu cầu "Fix verified isolated (≥ 20 run cùng pass)" cho test
 * mới — gate này auto-detect spec mới qua `git diff` (added file under
 * `tests/.../*.spec.ts`) → output JSON list cho stability-gate workflow.
 *
 * Inputs (env):
 *   BASE_REF            — git ref to diff against (default: origin/main)
 *   GITHUB_OUTPUT       — GH Actions step output file (optional)
 *
 * Outputs:
 *   stdout JSON: `{"specs":[...],"runnable":[...],"deviceRequired":[...]}`
 *     - specs: ALL newly added .spec.ts paths
 *     - runnable: subset that can run on CI (unit / integration / api)
 *     - deviceRequired: subset that need device farm (smoke / regression / visual / perf)
 *   GITHUB_OUTPUT (if set):
 *     - has_runnable=true|false
 *     - runnable_specs=<JSON array string>
 *     - device_specs=<JSON array string>
 *
 * Exit:
 *   0 — always (workflow consumer decides next step from outputs)
 *
 * Override:
 *   PR label `skip-stability-gate` → workflow handles short-circuit (not here).
 *   Decision 3 M7: rename detection edge case → reviewer add label.
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');

const BASE_REF = process.env.BASE_REF || 'origin/main';
const DEVICE_DIRS = ['tests/smoke/', 'tests/regression/', 'tests/visual/', 'tests/perf/', 'tests/nightly/', 'tests/negative/'];
const RUNNABLE_DIRS = ['tests/unit/', 'tests/integration/', 'tests/api/'];

function log(msg, ctx) {
  const ctxStr = ctx ? ` ${JSON.stringify(ctx)}` : '';
  console.error(`[detect-new-spec] ${msg}${ctxStr}`);
}

function git(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function detectAddedSpecs() {
  let diffOutput = '';
  try {
    diffOutput = git(`git diff --name-status ${BASE_REF}...HEAD`);
  } catch (e) {
    log('git diff failed — fallback to empty list', { error: e.message });
    return [];
  }

  return diffOutput
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, ...rest] = line.split('\t');
      return { status: status.trim(), path: rest.join('\t').trim() };
    })
    .filter((entry) => entry.status === 'A')
    .map((entry) => entry.path)
    .filter((p) => p.startsWith('tests/') && p.endsWith('.spec.ts'));
}

function classify(specs) {
  const runnable = specs.filter((p) => RUNNABLE_DIRS.some((d) => p.startsWith(d)));
  const deviceRequired = specs.filter((p) => DEVICE_DIRS.some((d) => p.startsWith(d)));
  const unknown = specs.filter((p) => !runnable.includes(p) && !deviceRequired.includes(p));
  if (unknown.length > 0) {
    log('Unknown spec location (not classified) — treating as device-required', { unknown });
    deviceRequired.push(...unknown);
  }
  return { runnable, deviceRequired };
}

function writeOutput(key, value) {
  const path = process.env.GITHUB_OUTPUT;
  if (!path) return;
  fs.appendFileSync(path, `${key}=${value}\n`);
}

(() => {
  const specs = detectAddedSpecs();
  const { runnable, deviceRequired } = classify(specs);

  const result = { specs, runnable, deviceRequired };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

  writeOutput('has_runnable', runnable.length > 0 ? 'true' : 'false');
  writeOutput('runnable_specs', JSON.stringify(runnable));
  writeOutput('device_specs', JSON.stringify(deviceRequired));

  log('Detection complete', {
    total: specs.length,
    runnable: runnable.length,
    deviceRequired: deviceRequired.length,
  });
})();
