#!/usr/bin/env node
/**
 * BrowserStack matrix runner — M6 Task 4.
 *
 * Spawns one `wdio` child process per device label. Each child sets
 * BS_DEVICE_FILTER=<label> so wdio.bs.ts narrows to that single capability.
 *
 * Modes:
 *   parallel (default) — all devices concurrently. Tail logs serialized.
 *   sequential (--sequential) — one device at a time (BS quota safe).
 *
 * Suite override: --suite smoke|regression|perf|visual (default smoke).
 *
 * Exit code: non-zero if any child fails. Aggregated summary printed at end.
 */
'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');

const DEVICES = [
  'pixel-7-a13',
  'pixel-6-a12',
  'galaxy-s22-a12',
  'oneplus-11-a13',
  'pixel-8-a14',
];

const args = process.argv.slice(2);
const sequential = args.includes('--sequential');
const suiteIdx = args.indexOf('--suite');
const suite = suiteIdx >= 0 && args[suiteIdx + 1] ? args[suiteIdx + 1] : 'smoke';
const filterIdx = args.indexOf('--devices');
const devices =
  filterIdx >= 0 && args[filterIdx + 1] ? args[filterIdx + 1].split(',') : DEVICES;

const wdioBin = path.resolve(__dirname, '..', 'node_modules', '.bin', 'wdio');
const wdioConfig = path.resolve(__dirname, '..', 'src', 'config', 'wdio.bs.ts');

function runOne(label) {
  return new Promise((resolve) => {
    const start = Date.now();
    const env = { ...process.env, BS_DEVICE_FILTER: label };
    const child = spawn(wdioBin, ['run', wdioConfig, '--suite', suite], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(`[${label}] ${text}`);
    });
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(`[${label}] ${text}`);
    });
    child.on('close', (code) => {
      resolve({
        label,
        code,
        durationMs: Date.now() - start,
        passed: code === 0,
        stdoutTail: stdout.slice(-500),
        stderrTail: stderr.slice(-500),
      });
    });
  });
}

(async () => {
  console.log(
    `[bs-matrix] suite=${suite} mode=${sequential ? 'sequential' : 'parallel'} devices=${devices.join(',')}`,
  );
  const startAll = Date.now();
  const results = sequential
    ? await devices.reduce(async (acc, d) => {
        const prev = await acc;
        const r = await runOne(d);
        return [...prev, r];
      }, Promise.resolve([]))
    : await Promise.all(devices.map(runOne));

  const totalMs = Date.now() - startAll;
  console.log('\n========== BS MATRIX SUMMARY ==========');
  for (const r of results) {
    const ok = r.passed ? 'PASS' : 'FAIL';
    console.log(
      `  [${ok}] ${r.label.padEnd(20)} code=${r.code} duration=${(r.durationMs / 1000).toFixed(1)}s`,
    );
  }
  const failed = results.filter((r) => !r.passed);
  console.log(
    `\n  Total: ${results.length} device | ${results.length - failed.length} pass | ${failed.length} fail | ${(totalMs / 1000).toFixed(1)}s`,
  );
  if (failed.length > 0) {
    console.error('\n[bs-matrix] FAIL — see per-device tails above.');
    process.exit(1);
  }
})();
