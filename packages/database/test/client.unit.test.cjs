const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

describe('createPrismaClient', () => {
  it('rejects an empty connection string before constructing a pool', async () => {
    const { createPrismaClient } = await import('../dist/src/index.js');

    assert.throws(
      () => createPrismaClient('   '),
      /A non-empty PostgreSQL connection string is required/u,
    );
  });
});
