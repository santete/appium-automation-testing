/**
 * Mocha config cho API specs — hit real public HTTP endpoint (no MSW, no WDIO).
 *
 * Plan ref: M3 Task 16, D3 repay path B.
 *
 * Tách khỏi `.mocharc.integration.cjs` (MSW, offline) vì API suite cần network.
 * Timeout cao hơn unit/integration vì real RTT.
 */
module.exports = {
  require: ['ts-node/register', './tests/_hooks/quarantine.ts'],
  'node-option': ['no-experimental-strip-types'],
  spec: ['tests/api/**/*.spec.ts'],
  extension: ['ts'],
  timeout: 20000,
  reporter: 'spec',
};
