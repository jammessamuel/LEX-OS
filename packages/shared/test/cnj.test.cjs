const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { cnjSegmentName, isValidCnj, normalizeCnj, parseCnj } = require('../dist/index.js');

const VALID = '0001234-27.2026.5.02.0001';

describe('CNJ', () => {
  it('accepts a number whose check digit is right', () => {
    assert.equal(isValidCnj(VALID), true);
  });

  it('refuses a number that only looks right', () => {
    // Forma perfeita, dígito trocado: passa em qualquer expressão regular e só apareceria
    // quando alguém tentasse consultar o processo.
    assert.equal(isValidCnj('0001234-28.2026.5.02.0001'), false);
  });

  it('catches a transposition, which is the typo a person actually makes', () => {
    assert.equal(isValidCnj('0001243-27.2026.5.02.0001'), false);
  });

  it('accepts the number pasted without punctuation', () => {
    const bare = VALID.replace(/\D/gu, '');

    assert.equal(normalizeCnj(bare), VALID);
    assert.equal(isValidCnj(bare), true);
  });

  it('refuses anything that is not twenty digits in the right shape', () => {
    for (const bad of ['', '123', '0001234-27.2026.5.02', 'abc', '0001234-27.2026.55.2.0001']) {
      assert.equal(isValidCnj(bad), false, `deveria recusar: ${bad}`);
    }
  });

  it('breaks the number into the parts the screen needs', () => {
    assert.deepEqual(parseCnj(VALID), {
      sequential: '0001234',
      checkDigit: '27',
      year: '2026',
      segment: '5',
      court: '02',
      origin: '0001',
    });
  });

  it('names the segment, so the screen does not show a lone digit', () => {
    assert.equal(cnjSegmentName(VALID), 'Justiça do Trabalho');
    assert.equal(
      cnjSegmentName('0001234-27.2026.8.26.0100'),
      'Justiça dos Estados e do Distrito Federal',
    );
    // O segmento 0 não existe na tabela do CNJ: nome nenhum é melhor que um inventado.
    assert.equal(cnjSegmentName('0001234-27.2026.0.02.0001'), null);
    assert.equal(cnjSegmentName('nao e numero'), null);
  });
});
