#!/usr/bin/env node
// Runs the worker integration suite.
//
// The previous inline script used POSIX shell syntax (`set -a; . ../../.env; set +a;` plus
// `VAR=value` command prefixes), so it only ran on Unix shells. The API and database
// packages already load configuration from Node instead; this runner brings the worker in
// line so the same command works on Windows, macOS, Linux, and CI.

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

// Host-side overrides: the suite talks to the Compose services through published ports and
// uses its own queue prefix so it never consumes another environment's jobs. Reconciliation
// is pushed far into the future so it cannot race the assertions.
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
