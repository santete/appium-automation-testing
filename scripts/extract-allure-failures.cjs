#!/usr/bin/env node
/**
 * Extract top-N failure summary từ allure-results dir (M5 Task 10).
 *
 * Output: JSON `{count, failures: [{name, fullName, message}]}` ra stdout.
 * Mục đích: feed vào notify-fail workflow để build Issue body.
 *
 * Allure result file shape (subset):
 *   {
 *     "uuid": "...",
 *     "name": "should login successfully",
 *     "fullName": "tests/smoke/login.spec.ts:should login successfully",
 *     "status": "passed | failed | broken | skipped",
 *     "statusDetails": { "message": "...", "trace": "..." }
 *   }
 *
 * Inputs (env):
 *   ALLURE_RESULTS_DIR — default ./reports/allure-results
 *   TOP_N              — default 3
 *
 * Exit:
 *   0 — always (no failure → empty array; missing dir → empty array + warn).
 */
const fs = require('node:fs');
const path = require('node:path');

const RESULTS_DIR = process.env.ALLURE_RESULTS_DIR || './reports/allure-results';
const TOP_N = parseInt(process.env.TOP_N || '3', 10);

function safeRead(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

if (!fs.existsSync(RESULTS_DIR)) {
  process.stdout.write(JSON.stringify({ count: 0, failures: [] }));
  process.exit(0);
}

const failures = [];
for (const entry of fs.readdirSync(RESULTS_DIR)) {
  if (!entry.endsWith('-result.json')) continue;
  const obj = safeRead(path.join(RESULTS_DIR, entry));
  if (!obj) continue;
  if (obj.status === 'failed' || obj.status === 'broken') {
    failures.push({
      name: obj.name || obj.fullName || 'unknown',
      fullName: obj.fullName || obj.name || 'unknown',
      message: (obj.statusDetails && obj.statusDetails.message) || '',
    });
  }
}

const top = failures.slice(0, TOP_N);
process.stdout.write(JSON.stringify({ count: failures.length, failures: top }));
