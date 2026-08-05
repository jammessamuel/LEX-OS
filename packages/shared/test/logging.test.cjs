const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { redactSensitiveData, writeStructuredLog } = require('../dist/index.js');

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
