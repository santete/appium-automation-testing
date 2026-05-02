/**
 * Mocha config cho Pact consumer specs (M6 Task 3).
 *
 * Pact mock spawns native binary mỗi spec → cần timeout > unit. Pact files
 * write tới `pacts/` (gitignored — published qua broker M7+).
 */
module.exports = {
  require: ['ts-node/register'],
  'node-option': ['no-experimental-strip-types'],
  spec: ['tests/pact/**/*.spec.ts'],
  extension: ['ts'],
  timeout: 30000,
  reporter: 'spec',
};
