const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { isUuidV4, redactSensitiveData, writeStructuredLog } = require('../dist/index.js');

describe('redactSensitiveData', () => {
  it('redacts nested credentials and identity fields', () => {
    assert.deepEqual(
      redactSensitiveData({
        databasePassword: 'do-not-print',
        nested: { authorization: 'Bearer do-not-print', cpf: '00000000000' },
        safe: 'visible',
      }),
      {
        databasePassword: '[REDACTED]',
        nested: { authorization: '[REDACTED]', cpf: '[REDACTED]' },
        safe: 'visible',
      },
    );
  });

  it('removes credentials embedded in URLs', () => {
    assert.equal(
      redactSensitiveData('postgres://user:password@database:5432/postgres'),
      'postgres://[REDACTED]@database:5432/postgres',
    );
  });

  it('never writes authentication secrets to structured logs', () => {
    const originalWrite = process.stdout.write;
    let output = '';
    process.stdout.write = (chunk) => {
      output += String(chunk);
      return true;
    };

    try {
      writeStructuredLog({
        level: 'info',
        service: 'lex-os-test',
        message: 'authentication_test',
        correlationId: 'test-correlation',
        metadata: {
          accessToken: 'access-secret-value',
          refreshToken: 'refresh-secret-value',
          password: 'password-secret-value',
          authorization: 'Bearer bearer-secret-value',
          safe: 'visible',
        },
      });
    } finally {
      process.stdout.write = originalWrite;
    }

    assert.equal(output.includes('access-secret-value'), false);
    assert.equal(output.includes('refresh-secret-value'), false);
    assert.equal(output.includes('password-secret-value'), false);
    assert.equal(output.includes('bearer-secret-value'), false);
    assert.equal(output.includes('visible'), true);
  });
});

describe('isUuidV4', () => {
  it('accepts canonical v4 identifiers in either case', () => {
    assert.equal(isUuidV4('00000000-0000-4000-8000-000000000001'), true);
    assert.equal(isUuidV4('A1B2C3D4-E5F6-4A7B-9C8D-0E1F2A3B4C5D'), true);
  });

  it('rejects anything that is not a canonical v4 identifier', () => {
    for (const value of [
      undefined,
      null,
      42,
      '',
      'not-a-uuid',
      '00000000-0000-1000-8000-000000000001', // version 1
      '00000000-0000-4000-c000-000000000001', // invalid variant nibble
      '00000000-0000-4000-8000-00000000000', // too short
      '00000000-0000-4000-8000-0000000000011', // too long
      ' 00000000-0000-4000-8000-000000000001', // leading space
      '00000000-0000-4000-8000-000000000001\n', // trailing newline
    ]) {
      assert.equal(isUuidV4(value), false, `expected ${JSON.stringify(value)} to be rejected`);
    }
  });
});
