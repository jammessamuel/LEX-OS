import globals from 'globals';

import baseConfig from './base.mjs';

export default [
  ...baseConfig,
  {
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'no-console': 'error',
    },
  },
  {
    files: ['**/*.{spec,test}.cjs'],
    languageOptions: {
      globals: globals.jest,
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];
