const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

describe('Brazilian person identifiers', () => {
  it('validates normalized CPF/CNPJ values and rejects repeated digits', async () => {
    const { isValidCnpj, isValidCpf } = await import('../../dist/persons/identifiers.js');

    assert.equal(isValidCpf('11144477735'), true);
    assert.equal(isValidCpf('00000000000'), false);
    assert.equal(isValidCnpj('11222333000181'), true);
    assert.equal(isValidCnpj('11111111111111'), false);
  });

  it('returns only masked identifiers to API mappers', async () => {
    const { maskCnpj, maskCpf, maskRg } = await import('../../dist/persons/identifiers.js');

    assert.equal(maskCpf('11144477735'), '***.***.***-35');
    assert.equal(maskCnpj('11222333000181'), '**.***.***/****-81');
    assert.equal(maskRg('FICTITIOUS1234'), '****1234');
  });
});
