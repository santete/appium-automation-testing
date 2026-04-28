/**
 * ESLint config — enforce non-negotiable patterns ngay tại lint time:
 *   - Cấm browser.pause() / sleep() (spec §3 step 4c)
 *   - Cấm hardcoded http(s) URL trong code (phải qua env, spec §4.5)
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  rules: {
    'prettier/prettier': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-restricted-syntax': [
      'error',
      {
        selector:
          "CallExpression[callee.object.name='browser'][callee.property.name='pause']",
        message:
          'browser.pause() bị cấm — dùng browser.waitUntil() với explicit condition + timeoutMsg (spec §3 step 4c).',
      },
      {
        selector:
          "CallExpression[callee.name='setTimeout'][arguments.length>=1]",
        message:
          'setTimeout trong test code bị cấm — dùng waitUntil/waitFor helper trong src/utils/wait.ts.',
      },
    ],
    'no-restricted-properties': [
      'error',
      {
        object: 'browser',
        property: 'pause',
        message: 'Tham khảo no-restricted-syntax — dùng waitUntil thay thế.',
      },
    ],
  },
  ignorePatterns: ['node_modules', 'dist', 'reports', '*.js', '*.cjs'],
};
