const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { describe, it } = require('node:test');

async function inspect(chunks, mimeType, extension) {
  const [{ FileStreamInspector }, { MockVirusScanner }] = await Promise.all([
    import('../../dist/files/file-stream-inspector.js'),
    import('../../dist/files/mock-virus-scanner.js'),
  ]);
  const inspector = new FileStreamInspector(
    new MockVirusScanner({ environment: 'test' }).createSession(),
  );
  for await (const chunk of Readable.from(chunks).pipe(inspector)) {
    // Descarta cada bloco do fluxo de propósito, sem agregar o arquivo em memória.
    void chunk;
  }
  return inspector.result(mimeType, extension);
}

describe('secure file intake primitives', () => {
  it('refuses to use the deterministic mock scanner in production', async () => {
    const { MockVirusScanner } = await import('../../dist/files/mock-virus-scanner.js');
    assert.throws(
      () => new MockVirusScanner({ environment: 'production' }),
      /cannot run in production/iu,
    );
  });

  it('sanitizes display-only filename characters and rejects path-like names', async () => {
    const { sanitizeFilename } = await import('../../dist/files/filename-policy.js');
    assert.deepEqual(sanitizeFilename(' contrato:fictício .pdf '), {
      displayName: 'contrato_fictício .pdf',
      extension: 'pdf',
      title: 'contrato_fictício ',
    });
    assert.throws(() => sanitizeFilename('../segredo.pdf'), /nome do arquivo é inválido/iu);
    assert.throws(() => sanitizeFilename('pasta\\segredo.pdf'), /nome do arquivo é inválido/iu);
  });

  it('detects PDF signatures, computes SHA-256, and rejects MIME mismatches', async () => {
    const content = Buffer.from('%PDF-1.7\nconteúdo fictício\n%%EOF\n', 'utf8');
    const result = await inspect(
      [content.subarray(0, 8), content.subarray(8)],
      'application/pdf',
      'pdf',
    );
    assert.equal(result.detectedMimeType, 'application/pdf');
    assert.equal(result.sizeBytes, content.length);
    assert.match(result.checksumSha256, /^[0-9a-f]{64}$/u);
    assert.equal(result.virusScanStatus, 'CLEAN');

    await assert.rejects(
      inspect([content], 'text/plain', 'txt'),
      (error) => error.publicCode === 'FILE_MIME_MISMATCH',
    );
  });

  it('returns fail-closed mock scanner outcomes without retaining streamed bytes', async () => {
    const infected = await inspect(
      [Buffer.from('EICAR-STANDARD-'), Buffer.from('ANTIVIRUS-TEST-FILE')],
      'text/plain',
      'txt',
    );
    assert.equal(infected.virusScanStatus, 'INFECTED');

    const unavailable = await inspect(
      [Buffer.from('LEXOS_MOCK_SCANNER_'), Buffer.from('UNAVAILABLE')],
      'text/plain',
      'txt',
    );
    assert.equal(unavailable.virusScanStatus, 'ERROR');

    const chunk = Buffer.alloc(64 * 1024, 0x61);
    const chunks = Array.from({ length: 96 }, () => chunk);
    const large = await inspect(chunks, 'text/plain', 'txt');
    assert.equal(large.sizeBytes, 6 * 1024 * 1024);
  });
});
