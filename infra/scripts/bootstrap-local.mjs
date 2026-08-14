#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

if (process.env.NODE_ENV !== 'development') {
  throw new Error('Local bootstrap requires NODE_ENV=development.');
}

const databaseUrl = new URL(process.env.DATABASE_URL ?? '');
if (!['127.0.0.1', 'localhost'].includes(databaseUrl.hostname)) {
  throw new Error('Local bootstrap refuses a non-local database endpoint.');
}

const steps = [
  ['infra:dependencies'],
  ['db:migrate:deploy'],
  ['db:migrate:status'],
  ['db:seed'],
  ['infra:up'],
];

for (const args of steps) {
  const result = spawnSync('corepack', ['pnpm', ...args], {
    cwd: process.cwd(),
    shell: false,
    stdio: 'inherit',
  });
  if (result.error !== undefined || result.status !== 0) {
    throw new Error(`Local bootstrap failed at: pnpm ${args.join(' ')}`);
  }
}

process.stdout.write('Local bootstrap complete: migrations, fictional seed, and healthy stack.\n');
