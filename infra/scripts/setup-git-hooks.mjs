#!/usr/bin/env node
// Points Git at the versioned .githooks/ directory so the commit-msg guard survives a
// fresh clone. Runs from the root `prepare` script on `pnpm install`.
//
// Must never fail the install: Docker builds and CI checkouts may have no .git directory
// and no git binary. In those environments there is nothing to wire up and that is fine.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const hooksPath = '.githooks';

function skip(reason) {
  process.stdout.write(`setup-git-hooks: skipped (${reason}).\n`);
  process.exit(0);
}

if (!existsSync(join(repositoryRoot, '.git'))) {
  skip('no .git directory');
}

if (!existsSync(join(repositoryRoot, hooksPath, 'commit-msg'))) {
  skip('no .githooks/commit-msg');
}

const result = spawnSync('git', ['config', 'core.hooksPath', hooksPath], {
  cwd: repositoryRoot,
  stdio: 'ignore',
  shell: false,
});

if (result.error !== undefined || result.status !== 0) {
  skip('git config unavailable');
}

process.stdout.write(`setup-git-hooks: core.hooksPath set to ${hooksPath}.\n`);
