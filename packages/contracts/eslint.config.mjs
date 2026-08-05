import nodeConfig from '@lex-os/eslint-config/node';

export default [
  ...nodeConfig,
  {
    files: ['test/**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];
