#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdtempSync, openSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const allowedEnvironments = new Set(['development', 'test']);
if (!allowedEnvironments.has(process.env.NODE_ENV ?? '')) {
  throw new Error('Recovery rehearsal is restricted to NODE_ENV=development or test.');
}

const databaseUrl = new URL(process.env.DATABASE_URL ?? '');
const dockerPort = process.env.POSTGRES_DOCKER_PORT ?? '5433';
if (
  !['127.0.0.1', 'localhost'].includes(databaseUrl.hostname) ||
  databaseUrl.port !== dockerPort ||
  !['127.0.0.1', 'localhost'].includes(process.env.DATABASE_HOST ?? '')
) {
  throw new Error('Recovery rehearsal requires the explicitly local Compose PostgreSQL endpoint.');
}

function docker(args, options = {}) {
  return execFileSync('docker', ['compose', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    ...options,
  });
}

function postgresShell(script, environment = {}) {
  const environmentArgs = Object.entries(environment).flatMap(([name, value]) => [
    '-e',
    `${name}=${value}`,
  ]);
  return docker(['exec', '-T', ...environmentArgs, 'postgres', 'sh', '-eu', '-c', script]).trim();
}

function runPostgresStream(script, stdio, environment = {}) {
  const environmentArgs = Object.entries(environment).flatMap(([name, value]) => [
    '-e',
    `${name}=${value}`,
  ]);
  const result = spawnSync(
    'docker',
    ['compose', 'exec', '-T', ...environmentArgs, 'postgres', 'sh', '-eu', '-c', script],
    { cwd: process.cwd(), stdio },
  );
  if (result.error !== undefined || result.status !== 0) {
    const detail = Buffer.isBuffer(result.stderr) ? result.stderr.toString('utf8').trim() : '';
    throw new Error(`PostgreSQL recovery command failed${detail === '' ? '.' : `: ${detail}`}`);
  }
}

const requiredServices = new Set(['api', 'minio', 'postgres', 'redis', 'web', 'worker']);
const runningServices = new Set(
  docker(['ps', '--status', 'running', '--services'])
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean),
);
for (const service of requiredServices) {
  if (!runningServices.has(service)) {
    throw new Error(`Recovery rehearsal requires the healthy local service: ${service}.`);
  }
}

const syntheticGuardSql = `
  SELECT json_build_object(
    'nonFictionalOrganizations', (
      SELECT count(*) FROM organizations
      WHERE coalesce(settings ->> 'fixture', 'false') <> 'true'
    ),
    'nonFictionalUsers', (
      SELECT count(*) FROM users WHERE email !~ '@[^@]+\\.invalid$'
    ),
    'fictionalOrganizations', (SELECT count(*) FROM organizations)
  )::text;
`;
const syntheticGuard = JSON.parse(
  postgresShell(
    `psql --tuples-only --no-align --set ON_ERROR_STOP=1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --command "$SYNTHETIC_GUARD_SQL"`,
    { SYNTHETIC_GUARD_SQL: syntheticGuardSql },
  ),
);
if (
  syntheticGuard.nonFictionalOrganizations !== 0 ||
  syntheticGuard.nonFictionalUsers !== 0 ||
  syntheticGuard.fictionalOrganizations < 1
) {
  throw new Error('Recovery rehearsal refused a database that is not exclusively fictional.');
}

const fingerprintSql = `
  SELECT json_build_object(
    'organizations', (SELECT count(*) || ':' || coalesce(md5(string_agg(id::text, ',' ORDER BY id)), '') FROM organizations),
    'users', (SELECT count(*) || ':' || coalesce(md5(string_agg(id::text, ',' ORDER BY id)), '') FROM users),
    'cases', (SELECT count(*) || ':' || coalesce(md5(string_agg(id::text, ',' ORDER BY id)), '') FROM cases),
    'files', (SELECT count(*) || ':' || coalesce(md5(string_agg(id::text, ',' ORDER BY id)), '') FROM files),
    'documents', (SELECT count(*) || ':' || coalesce(md5(string_agg(id::text, ',' ORDER BY id)), '') FROM documents),
    'extractions', (SELECT count(*) || ':' || coalesce(md5(string_agg(id::text, ',' ORDER BY id)), '') FROM document_extractions),
    'timelineEvents', (SELECT count(*) || ':' || coalesce(md5(string_agg(id::text, ',' ORDER BY id)), '') FROM timeline_events),
    'knowledgeChunks', (SELECT count(*) || ':' || coalesce(md5(string_agg(id::text, ',' ORDER BY id)), '') FROM knowledge_chunks),
    'processingJobs', (SELECT count(*) || ':' || coalesce(md5(string_agg(id::text, ',' ORDER BY id)), '') FROM processing_jobs),
    'auditLogs', (SELECT count(*) || ':' || coalesce(md5(string_agg(id::text, ',' ORDER BY id)), '') FROM audit_logs),
    'migrations', (SELECT count(*) FROM _prisma_migrations)
  )::text;
`;

function fingerprint(targetDatabase) {
  return postgresShell(
    `psql --tuples-only --no-align --set ON_ERROR_STOP=1 --username="$POSTGRES_USER" --dbname="$TARGET_DATABASE" --command "$FINGERPRINT_SQL"`,
    { FINGERPRINT_SQL: fingerprintSql, TARGET_DATABASE: targetDatabase },
  );
}

const nonce = randomUUID().replaceAll('-', '').slice(0, 16);
const restoreDatabase = `lex_os_restore_${nonce}`;
const restoreBucket = `lex-os-restore-${nonce}`;
const markerKey = `recovery-rehearsal/${nonce}.txt`;
const markerValue = `lex-os-recovery-${nonce}`;
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'lex-os-recovery-'));
const dumpPath = join(temporaryDirectory, 'postgres.dump');
let restoreDatabaseCreated = false;
let objectMarkerCreated = false;

try {
  const sourceFingerprint = fingerprint(process.env.DATABASE_NAME ?? 'postgres');
  const dumpDescriptor = openSync(dumpPath, 'w', 0o600);
  runPostgresStream(
    'exec pg_dump --format=custom --no-owner --no-acl --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"',
    ['ignore', dumpDescriptor, 'pipe'],
  );
  closeSync(dumpDescriptor);
  if (statSync(dumpPath).size === 0) {
    throw new Error('PostgreSQL backup is empty.');
  }

  postgresShell('createdb --username="$POSTGRES_USER" "$RESTORE_DATABASE"', {
    RESTORE_DATABASE: restoreDatabase,
  });
  restoreDatabaseCreated = true;
  const restoreDescriptor = openSync(dumpPath, 'r');
  runPostgresStream(
    'exec pg_restore --exit-on-error --no-owner --no-acl --username="$POSTGRES_USER" --dbname="$RESTORE_DATABASE"',
    [restoreDescriptor, 'ignore', 'pipe'],
    { RESTORE_DATABASE: restoreDatabase },
  );
  closeSync(restoreDescriptor);
  const restoredFingerprint = fingerprint(restoreDatabase);
  if (restoredFingerprint !== sourceFingerprint) {
    throw new Error('Restored PostgreSQL fingerprint differs from the source.');
  }

  objectMarkerCreated = true;
  docker(
    [
      'run',
      '--rm',
      '--no-deps',
      '--entrypoint',
      '/bin/sh',
      '-e',
      `RESTORE_BUCKET=${restoreBucket}`,
      '-e',
      `MARKER_KEY=${markerKey}`,
      '-e',
      `MARKER_VALUE=${markerValue}`,
      'minio-init',
      '-eu',
      '-c',
      `
        mc alias set recovery http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
        printf '%s' "$MARKER_VALUE" | mc pipe "recovery/$MINIO_BUCKET/$MARKER_KEY" >/dev/null
        mc cp "recovery/$MINIO_BUCKET/$MARKER_KEY" /tmp/recovery-marker >/dev/null
        mc mb "recovery/$RESTORE_BUCKET" >/dev/null
        mc anonymous set none "recovery/$RESTORE_BUCKET" >/dev/null
        mc cp /tmp/recovery-marker "recovery/$RESTORE_BUCKET/$MARKER_KEY" >/dev/null
        test "$(mc cat "recovery/$RESTORE_BUCKET/$MARKER_KEY")" = "$MARKER_VALUE"
      `,
    ],
    { stdio: 'ignore' },
  );
  process.stdout.write(
    'Recovery rehearsal passed: fictional PostgreSQL dump/restore fingerprint and private object copy verified.\n',
  );
} finally {
  if (objectMarkerCreated) {
    try {
      docker(
        [
          'run',
          '--rm',
          '--no-deps',
          '--entrypoint',
          '/bin/sh',
          '-e',
          `RESTORE_BUCKET=${restoreBucket}`,
          '-e',
          `MARKER_KEY=${markerKey}`,
          'minio-init',
          '-eu',
          '-c',
          `
            mc alias set recovery http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
            mc rm --force "recovery/$MINIO_BUCKET/$MARKER_KEY" >/dev/null
            mc rb --force "recovery/$RESTORE_BUCKET" >/dev/null
          `,
        ],
        { stdio: 'ignore' },
      );
    } catch {
      process.stderr.write('Warning: inspect the synthetic MinIO recovery markers manually.\n');
    }
  }
  if (restoreDatabaseCreated) {
    try {
      postgresShell('dropdb --if-exists --force --username="$POSTGRES_USER" "$RESTORE_DATABASE"', {
        RESTORE_DATABASE: restoreDatabase,
      });
    } catch {
      process.stderr.write(`Warning: drop the temporary database ${restoreDatabase} manually.\n`);
    }
  }
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
