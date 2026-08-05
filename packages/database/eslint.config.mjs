import nodeConfig from '@lex-os/eslint-config/node';

export default [
  ...nodeConfig,
  {
    ignores: ['src/generated/**'],
  },
  {
    files: ['test/**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['prisma/seed.ts', 'scripts/**/*.mjs'],
    rules: {
      'no-console': 'off',
    },
  },
];
