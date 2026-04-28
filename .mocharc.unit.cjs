/**
 * Mocha config cho unit tests — KHÔNG load WDIO runtime.
 *
 * Plan ref: M2 Task 10 — `npm run test:unit` chạy mocha standalone.
 *
 * `node-option: no-experimental-strip-types` — Node 22+ default tries built-in
 * TS strip (không support parameter property), conflict với ts-node. Disable
 * để ts-node/register handle full TS.
 */
module.exports = {
  require: ['ts-node/register'],
  'node-option': ['no-experimental-strip-types'],
  spec: ['tests/unit/**/*.spec.ts'],
  extension: ['ts'],
  timeout: 5000,
  reporter: 'spec',
};
