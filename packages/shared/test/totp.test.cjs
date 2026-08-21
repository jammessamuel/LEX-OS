const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { describe, it } = require('node:test');

const {
  decodeBase32,
  decryptSecret,
  encodeBase32,
  encryptSecret,
  newRecoveryCodes,
  newTotpSecret,
  totpCodeAt,
  totpStepAt,
  totpUri,
  verifyTotp,
} = require('../dist/index.js');

// Vetor da RFC 6238: segredo ASCII "12345678901234567890" em base32.
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('TOTP', () => {
  it('reproduces the RFC 6238 reference vectors', () => {
    // Sem isto, um erro de deslocamento no truncamento passaria despercebido e só apareceria
    // como "meu aplicativo não funciona" em produção.
    assert.equal(totpCodeAt(RFC_SECRET, 59_000), '287082');
    assert.equal(totpCodeAt(RFC_SECRET, 1_111_111_109_000), '081804');
    assert.equal(totpCodeAt(RFC_SECRET, 1_234_567_890_000), '005924');
  });

  it('accepts one step of drift on each side, and refuses two', () => {
    const now = 1_700_000_000_000;
    const step = 30_000;

    assert.equal(verifyTotp(RFC_SECRET, totpCodeAt(RFC_SECRET, now), now), true);
    assert.equal(verifyTotp(RFC_SECRET, totpCodeAt(RFC_SECRET, now - step), now), true);
    assert.equal(verifyTotp(RFC_SECRET, totpCodeAt(RFC_SECRET, now + step), now), true);
    // Dois passos é um minuto: relógio de celular não erra tanto, e aceitar alargaria a janela.
    assert.equal(verifyTotp(RFC_SECRET, totpCodeAt(RFC_SECRET, now - 2 * step), now), false);
    assert.equal(verifyTotp(RFC_SECRET, totpCodeAt(RFC_SECRET, now + 2 * step), now), false);
  });

  it('refuses anything that is not six digits', () => {
    const now = 1_700_000_000_000;
    for (const bad of ['', '12345', '1234567', 'abcdef', '  ']) {
      assert.equal(verifyTotp(RFC_SECRET, bad, now), false);
    }
  });

  it('ignores separators a person may type from the app', () => {
    const now = 1_700_000_000_000;
    const code = totpCodeAt(RFC_SECRET, now);

    assert.equal(verifyTotp(RFC_SECRET, `${code.slice(0, 3)} ${code.slice(3)}`, now), true);
  });

  it('round-trips base32 and generates a secret an authenticator can read', () => {
    const bytes = randomBytes(20);
    assert.deepEqual(decodeBase32(encodeBase32(bytes)), bytes);

    const secret = newTotpSecret();
    assert.match(secret, /^[A-Z2-7]{32}$/u);
  });

  it('builds an otpauth address with the issuer and the account', () => {
    const uri = totpUri({
      secret: RFC_SECRET,
      account: 'ana@escritorio.invalid',
      issuer: 'LEX OS',
    });

    assert.ok(uri.startsWith('otpauth://totp/LEX%20OS%3Aana%40escritorio.invalid?'));
    assert.match(uri, /secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ/u);
    assert.match(uri, /period=30/u);
    assert.match(uri, /digits=6/u);
  });

  it('encrypts the secret so a database dump does not hand over the second factor', () => {
    const key = randomBytes(32);
    const secret = newTotpSecret();
    const stored = encryptSecret(secret, key);

    assert.equal(stored.includes(secret), false, 'the stored value must not contain the secret');
    assert.equal(decryptSecret(stored, key), secret);
    // Duas cifragens do mesmo segredo diferem: o vetor de inicialização é novo a cada vez.
    assert.notEqual(encryptSecret(secret, key), stored);
  });

  it('refuses to decrypt with the wrong key instead of returning garbage', () => {
    const stored = encryptSecret(newTotpSecret(), randomBytes(32));

    assert.throws(() => decryptSecret(stored, randomBytes(32)));
  });

  it('detects tampering, because GCM authenticates the payload', () => {
    const key = randomBytes(32);
    const [iv, tag, payload] = encryptSecret('GEZDGNBVGY3TQOJQ', key).split(':');
    const flipped = Buffer.from(payload, 'base64url');
    flipped[0] ^= 1;

    assert.throws(() => decryptSecret(`${iv}:${tag}:${flipped.toString('base64url')}`, key));
  });

  it('reports the step so the server can refuse a replayed code', () => {
    assert.equal(totpStepAt(59_000), 1);
    assert.equal(totpStepAt(89_000), 2);
  });

  it('issues distinct recovery codes in a readable shape', () => {
    const codes = newRecoveryCodes();

    assert.equal(codes.length, 10);
    assert.equal(new Set(codes).size, 10);
    for (const code of codes) {
      assert.match(code, /^[0-9A-F]{5}-[0-9A-F]{5}$/u);
    }
  });
});
