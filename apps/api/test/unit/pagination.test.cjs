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

describe('createTimestampIdCursorParser', () => {
  const validId = '00000000-0000-4000-8000-000000000001';

  it('parses the timestamp field it was built for', async () => {
    const { createTimestampIdCursorParser } = await import('../../dist/http/pagination.js');
    const parse = createTimestampIdCursorParser('createdAt');
    const parsed = parse({ createdAt: '2026-08-05T12:00:00.000Z', id: validId });

    assert.equal(parsed.id, validId);
    assert.ok(parsed.createdAt instanceof Date);
    assert.equal(parsed.createdAt.toISOString(), '2026-08-05T12:00:00.000Z');
  });

  it('keeps each resource family bound to its own ordering column', async () => {
    const { createTimestampIdCursorParser } = await import('../../dist/http/pagination.js');
    const parseUpdated = createTimestampIdCursorParser('updatedAt');

    assert.equal(parseUpdated({ createdAt: '2026-08-05T12:00:00.000Z', id: validId }), undefined);
    assert.ok(parseUpdated({ updatedAt: '2026-08-05T12:00:00.000Z', id: validId }) !== undefined);
  });

  it('rejects tampered, missing, and wrongly typed cursor payloads', async () => {
    const { createTimestampIdCursorParser } = await import('../../dist/http/pagination.js');
    const parse = createTimestampIdCursorParser('createdAt');
    const timestamp = '2026-08-05T12:00:00.000Z';

    assert.equal(parse(null), undefined, 'null payload');
    assert.equal(parse('a string'), undefined, 'non-object payload');
    assert.equal(parse({ id: validId }), undefined, 'missing timestamp');
    assert.equal(parse({ createdAt: timestamp }), undefined, 'missing id');
    assert.equal(parse({ createdAt: 'not-a-date', id: validId }), undefined, 'unparseable date');
    assert.equal(parse({ createdAt: 1_754_395_200_000, id: validId }), undefined, 'numeric date');
    assert.equal(parse({ createdAt: timestamp, id: 'not-a-uuid' }), undefined, 'malformed id');
    assert.equal(
      parse({ createdAt: timestamp, id: "1' OR '1'='1" }),
      undefined,
      'injection attempt in the identifier',
    );
    assert.equal(
      parse({ createdAt: timestamp, id: '00000000-0000-1000-8000-000000000001' }),
      undefined,
      'non-v4 UUID',
    );
  });
});
