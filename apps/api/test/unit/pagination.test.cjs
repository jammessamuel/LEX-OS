const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

require('reflect-metadata');

const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');

describe('CursorPaginationQueryDto', () => {
  it('applies a bounded default and rejects oversized pages', async () => {
    const { CursorPaginationQueryDto } = await import('../../dist/http/pagination.js');
    const defaults = plainToInstance(CursorPaginationQueryDto, {});
    const oversized = plainToInstance(CursorPaginationQueryDto, { limit: '101' });

    assert.equal(defaults.limit, 20);
    assert.deepEqual(await validate(defaults), []);
    assert.ok((await validate(oversized)).length > 0);
  });

  it('round-trips opaque cursor data and rejects malformed cursors', async () => {
    const { decodeCursor, encodeCursor } = await import('../../dist/http/pagination.js');
    const encoded = encodeCursor({ id: '00000000-0000-4000-8000-000000000001' });
    const decoded = decodeCursor(encoded, (value) => value);

    assert.deepEqual(decoded, { id: '00000000-0000-4000-8000-000000000001' });
    assert.throws(
      () => decodeCursor('not+base64', () => undefined),
      (error) => error.code === 'INVALID_CURSOR',
    );
  });
});
