#!/usr/bin/env node
// Aponta o Git para `.githooks`, mantendo a proteção commit-msg após uma nova clonagem.
// Executa pelo script `prepare` da raiz durante `pnpm install`.
//
// Não pode interromper a instalação: imagens Docker e checkouts da CI podem não ter `.git`
// ou o executável do Git, e nesses ambientes não há gancho a configurar.

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
