#!/usr/bin/env node
// Inicia PostgreSQL, Redis, MinIO, a criação inicial do bucket e Mailpit.
//
// `minio-init` termina após criar o bucket, mas `docker compose up --wait` interpreta essa
// saída como falha. Por isso a criação roda separadamente e em primeiro plano, propagando
// o código de saída real. O executor Node mantém o comportamento igual entre sistemas.

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const longRunningServices = ['postgres', 'redis', 'minio', 'mailpit'];

function compose(args) {
  const result = spawnSync('docker', ['compose', ...args], {
    cwd: repositoryRoot,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error !== undefined) {
    process.stderr.write(
      'Docker is required to start the local dependencies. Install Docker Desktop or a ' +
        'compatible engine with Compose, then run this command again.\n',
    );
    process.exit(1);
  }

  return result.status ?? 1;
}

const started = compose(['up', '--detach', '--wait', ...longRunningServices]);

if (started !== 0) {
  process.exit(started);
}

// `run --rm` espera a criação terminar e propaga falhas; `--no-TTY` atende à CI sem terminal.
process.exit(compose(['run', '--rm', '--no-TTY', 'minio-init']));
