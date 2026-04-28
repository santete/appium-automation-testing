/**
 * Mocha config cho integration tests — load YAML contracts + MSW.
 * KHÔNG load WDIO runtime (vẫn standalone Node).
 */
module.exports = {
  require: ['ts-node/register'],
  'node-option': ['no-experimental-strip-types'],
  spec: ['tests/integration/**/*.spec.ts'],
  extension: ['ts'],
  timeout: 10000,
  reporter: 'spec',
};
