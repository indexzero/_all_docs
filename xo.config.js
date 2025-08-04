export default {
  space: 2,
  semicolon: true,
  prettier: false,
  rules: {
    'unicorn/prevent-abbreviations': 'off',
    'import/extensions': 'off',
    '@stylistic/comma-dangle': ['error', 'never'],
    '@stylistic/indent-binary-ops': ['error', 2],
    '@stylistic/object-curly-spacing': 'off',
    '@stylistic/function-paren-newline': 'off',
    'unicorn/no-process-exit': 'off',
    'unicorn/import-style': 'off',
    'no-return-await': 'off',
    'unicorn/catch-error-name': ['error', { name: 'err' }],
    'unicorn/no-array-for-each': 'off',
    'unicorn/no-array-reduce': 'off',
    'unicorn/no-array-callback-reference': 'off'
  }
};
