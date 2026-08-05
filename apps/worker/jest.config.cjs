/** @type {import('jest').Config} */
module.exports = {
  clearMocks: true,
  collectCoverageFrom: ['dist/**/*.js', '!dist/main.js'],
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.spec.cjs'],
  testPathIgnorePatterns: ['\\.integration\\.spec\\.cjs$'],
};
