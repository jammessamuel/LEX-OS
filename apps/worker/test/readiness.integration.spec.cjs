const { mkdtemp, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

let clearReadinessSignal;
let createReadinessSignal;

beforeAll(async () => {
  ({ clearReadinessSignal, createReadinessSignal } = await import('../dist/readiness.js'));
});

describe('worker readiness signal', () => {
  it('creates and removes a private readiness file', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'lex-os-worker-test-'));
    const filePath = join(directory, 'runtime', 'ready.json');

    try {
      await createReadinessSignal(filePath);
      const signal = JSON.parse(await readFile(filePath, 'utf8'));

      expect(signal.status).toBe('ready');

      await clearReadinessSignal(filePath);
      await expect(readFile(filePath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
