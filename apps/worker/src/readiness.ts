import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function createReadinessSignal(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    JSON.stringify({ status: 'ready', createdAt: new Date().toISOString() }),
    { encoding: 'utf8', mode: 0o600 },
  );
}

export async function clearReadinessSignal(filePath: string): Promise<void> {
  await rm(filePath, { force: true });
}
