#!/usr/bin/env node
// Executa os testes de integração do worker.
//
// O executor Node substitui sintaxe exclusiva de shell POSIX para manter o mesmo comando
// funcional no Windows, macOS, Linux e na CI.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workerRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(workerRoot, '..', '..');
const environmentFile = join(repositoryRoot, '.env');

if (!existsSync(environmentFile)) {
  process.stderr.write(
    'Worker integration tests need a repository .env file. Copy .env.example and fill in ' +
      'local-only values before running them.\n',
  );
  process.exit(1);
}

process.loadEnvFile(environmentFile);

// Os testes usam as portas publicadas pelo Compose e um prefixo de fila exclusivo. A
// reconciliação fica distante para não disputar execução com as asserções.
const overrides = {
  NODE_ENV: 'test',
  DATABASE_HOST: '127.0.0.1',
  DATABASE_PORT: '5433',
  REDIS_HOST: '127.0.0.1',
  PROCESSING_QUEUE_PREFIX: 'lex-os-d7-worker-integration',
  PROCESSING_STALE_AFTER_SECONDS: '86400',
  PROCESSING_RECONCILE_INTERVAL_SECONDS: '3600',
  PROCESSING_JOB_BACKOFF_MS: '100',
};

const jest = join(workerRoot, 'node_modules', 'jest', 'bin', 'jest.js');

const result = spawnSync(
  process.execPath,
  [
    '--experimental-vm-modules',
    jest,
    '--config',
    'test/jest.integration.config.cjs',
    '--passWithNoTests',
    '--runInBand',
  ],
  {
    cwd: workerRoot,
    stdio: 'inherit',
    env: { ...process.env, ...overrides },
    shell: false,
  },
);

process.exit(result.status ?? 1);
