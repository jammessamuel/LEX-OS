#!/usr/bin/env node
// Starts the local dependency stack: PostgreSQL, Redis, MinIO, the MinIO bucket bootstrap,
// and Mailpit.
//
// `docker compose up --wait` waits for every named service to reach running or healthy.
// `minio-init` is a one-shot container that creates the bucket and exits 0, and `--wait`
// reports that exit as a failure regardless of the code, so naming it alongside the
// long-running services makes the command fail after everything came up correctly.
//
// The bootstrap therefore runs as its own foreground step, which both propagates its real
// exit code and guarantees the bucket exists before anything downstream needs it.
//
// Written as a Node runner rather than a shell one-liner so it behaves identically in
// PowerShell, cmd, and POSIX shells.

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

// `run --rm` blocks until the bootstrap finishes and returns its exit code, so a failed
// bucket creation fails this command instead of silently leaving storage unconfigured.
// `--no-TTY` keeps it well behaved on a CI runner, which has no terminal attached.
process.exit(compose(['run', '--rm', '--no-TTY', 'minio-init']));
