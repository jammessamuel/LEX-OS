#!/usr/bin/env node
// Backup and restore rehearsal against the Compose PostgreSQL, using synthetic data only.
//
// The rehearsal proves the documented procedure works end to end: dump the database,
// destroy the schema, restore the dump, and verify that the fictional seed survived the
// round trip. It runs in CI after the integration tests so the procedure is exercised
// continuously instead of rotting in a document. It must never point at a real database:
// the target is always the local/CI Compose stack loaded exclusively with fictional data.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SEED_ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';

function fail(message) {
  process.stderr.write(`backup-restore-rehearsal: ${message}\n`);
  process.exit(1);
}

function loadDatabaseSettings() {
  let content;
  try {
    content = readFileSync(join(repositoryRoot, '.env'), 'utf8');
  } catch {
    fail('.env is required (see README, section "Fluxo de banco de dados").');
  }
  const settings = {};
  for (const line of content.split(/\r?\n/u)) {
    const match = /^([A-Z0-9_]+)=(.*)$/u.exec(line);
    if (match !== null) {
      settings[match[1]] = match[2];
    }
  }
  for (const key of ['DATABASE_NAME', 'DATABASE_USER']) {
    if (settings[key] === undefined || settings[key] === '') {
      fail(`${key} is required in .env.`);
    }
  }
  return settings;
}

function compose(args, options = {}) {
  const result = spawnSync('docker', ['compose', ...args], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    ...options,
  });
  if (result.error !== undefined) {
    fail(`docker compose failed to start: ${result.error.message}`);
  }
  return result;
}

function psql(settings, sql, { mustSucceed = true } = {}) {
  const result = compose([
    'exec',
    '-T',
    'postgres',
    'psql',
    '--username',
    settings.DATABASE_USER,
    '--dbname',
    settings.DATABASE_NAME,
    '--no-psqlrc',
    '--tuples-only',
    '--command',
    sql,
  ]);
  if (mustSucceed && result.status !== 0) {
    fail(`psql failed (${sql}): ${result.stderr}`);
  }
  return result;
}

const settings = loadDatabaseSettings();
const workDirectory = mkdtempSync(join(tmpdir(), 'lex-os-rehearsal-'));
const dumpPath = join(workDirectory, 'backup.sql');

// 1. The database must contain the fictional seed before the rehearsal makes sense.
const seeded = psql(
  settings,
  `SELECT count(*) FROM organizations WHERE id = '${SEED_ORGANIZATION_ID}';`,
);
if (seeded.stdout.trim() !== '1') {
  fail('the fictional seed organization is missing; run pnpm db:seed first.');
}

// 2. Backup: plain-format dump so the restore path needs nothing beyond psql.
process.stdout.write('backup-restore-rehearsal: dumping database...\n');
const dump = compose([
  'exec',
  '-T',
  'postgres',
  'pg_dump',
  '--username',
  settings.DATABASE_USER,
  '--dbname',
  settings.DATABASE_NAME,
  '--no-owner',
  '--no-privileges',
]);
if (dump.status !== 0 || dump.stdout.length === 0) {
  fail(`pg_dump failed: ${dump.stderr}`);
}
writeFileSync(dumpPath, dump.stdout, 'utf8');

// 3. Destroy: drop the schema so the restore starts from a genuinely empty database.
process.stdout.write('backup-restore-rehearsal: dropping schema...\n');
psql(settings, 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
const emptied = psql(settings, `SELECT to_regclass('public.organizations');`);
if (emptied.stdout.trim() !== '') {
  fail('the schema survived the drop; the rehearsal cannot prove the restore.');
}

// 4. Restore from the dump through stdin.
process.stdout.write('backup-restore-rehearsal: restoring from dump...\n');
const restore = compose(
  [
    'exec',
    '-T',
    'postgres',
    'psql',
    '--username',
    settings.DATABASE_USER,
    '--dbname',
    settings.DATABASE_NAME,
    '--no-psqlrc',
    '--set',
    'ON_ERROR_STOP=on',
  ],
  { input: readFileSync(dumpPath, 'utf8') },
);
if (restore.status !== 0) {
  fail(`restore failed: ${restore.stderr}`);
}

// 5. Verify: the seed organization and the migration ledger survived the round trip.
const restored = psql(
  settings,
  `SELECT count(*) FROM organizations WHERE id = '${SEED_ORGANIZATION_ID}';`,
);
if (restored.stdout.trim() !== '1') {
  fail('the seed organization did not survive the restore.');
}
const migrations = psql(settings, 'SELECT count(*) FROM _prisma_migrations;');
if (Number(migrations.stdout.trim()) < 1) {
  fail('the migration ledger did not survive the restore.');
}

process.stdout.write('backup-restore-rehearsal: backup, destroy, restore, verify — all passed.\n');
