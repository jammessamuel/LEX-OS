const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const path = require('node:path');
const { after, before, describe, it } = require('node:test');

const { NestFactory } = require('@nestjs/core');
const { Pool } = require('pg');
const request = require('supertest');

process.loadEnvFile(path.resolve(__dirname, '../../../../.env'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_HOST = '127.0.0.1';
process.env.DATABASE_PORT = '5433';
process.env.REDIS_HOST = '127.0.0.1';
process.env.PROCESSING_QUEUE_PREFIX = 'lex-os-dashboard-integration';

const ORGANIZATION_ID = '92000000-0000-4000-8000-000000000001';
const FULL_USER_ID = '92000000-0000-4000-8000-000000000002';
const STANDARD_USER_ID = '92000000-0000-4000-8000-000000000003';
const FULL_EMAIL = 'd10-dashboard-full@lexos.invalid';
const STANDARD_EMAIL = 'd10-dashboard-standard@lexos.invalid';
const SOURCE_ADMIN_ID = '00000000-0000-4000-8000-000000000002';
const ADMIN_ROLE_ID = '00000000-0000-4000-8000-000000000101';
const INTERN_ROLE_ID = '00000000-0000-4000-8000-000000000105';

const databaseUrl = process.env.DATABASE_URL;
const seedPassword = process.env.SEED_ADMIN_PASSWORD;
if (databaseUrl === undefined || seedPassword === undefined) {
  throw new Error(
    'DATABASE_URL and SEED_ADMIN_PASSWORD are required for dashboard integration tests.',
  );
}

const pool = new Pool({ connectionString: databaseUrl });
let app;
let http;
let fullToken;
let standardToken;

function checksum(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function cleanup() {
  await pool.query('DELETE FROM audit_logs WHERE organization_id = $1', [ORGANIZATION_ID]);
  await pool.query(
    `DELETE FROM processing_jobs
     WHERE organization_id = $1`,
    [ORGANIZATION_ID],
  );
  await pool.query('DELETE FROM tasks WHERE organization_id = $1', [ORGANIZATION_ID]);
  await pool.query('DELETE FROM documents WHERE organization_id = $1', [ORGANIZATION_ID]);
  await pool.query('DELETE FROM files WHERE organization_id = $1', [ORGANIZATION_ID]);
  await pool.query('DELETE FROM cases WHERE organization_id = $1', [ORGANIZATION_ID]);
  await pool.query('DELETE FROM refresh_sessions WHERE organization_id = $1', [ORGANIZATION_ID]);
  await pool.query('DELETE FROM user_roles WHERE user_id IN ($1, $2)', [
    FULL_USER_ID,
    STANDARD_USER_ID,
  ]);
  await pool.query('DELETE FROM users WHERE organization_id = $1', [ORGANIZATION_ID]);
  await pool.query('DELETE FROM organizations WHERE id = $1', [ORGANIZATION_ID]);
}

async function setupFixtures() {
  await pool.query(
    `INSERT INTO organizations
      (id, legal_name, trade_name, document_number, subscription_plan, updated_at)
     VALUES ($1, 'Organização Painel Fictícia', 'Painel Fictício', 'D10-DASHBOARD', 'TEST', now())`,
    [ORGANIZATION_ID],
  );
  await pool.query(
    `INSERT INTO users
      (id, organization_id, name, email, password_hash, status, updated_at)
     SELECT $1::uuid, $2::uuid, 'Supervisora Fictícia', $3, password_hash,
            'ACTIVE'::user_status, now()
     FROM users WHERE id = $4::uuid
     UNION ALL
     SELECT $5::uuid, $2::uuid, 'Leitora Padrão Fictícia', $6, password_hash,
            'ACTIVE'::user_status, now()
     FROM users WHERE id = $4::uuid`,
    [FULL_USER_ID, ORGANIZATION_ID, FULL_EMAIL, SOURCE_ADMIN_ID, STANDARD_USER_ID, STANDARD_EMAIL],
  );
  await pool.query(
    `INSERT INTO user_roles (user_id, role_id)
     VALUES ($1, $2), ($3, $4)`,
    [FULL_USER_ID, ADMIN_ROLE_ID, STANDARD_USER_ID, INTERN_ROLE_ID],
  );

  const standardCaseId = randomUUID();
  const confidentialCaseId = randomUUID();
  await pool.query(
    `INSERT INTO cases
      (id, organization_id, internal_code, title, legal_area, case_type, status, priority,
       confidentiality_level, responsible_user_id, updated_at)
     VALUES ($1, $3, 'D10-DASH-STANDARD', 'Caso padrão fictício', 'TEST', 'TEST',
             'ACTIVE', 'NORMAL', 'STANDARD', $4, now()),
            ($2, $3, 'D10-DASH-CONF', 'Caso confidencial fictício', 'TEST', 'TEST',
             'UNDER_ANALYSIS', 'HIGH', 'CONFIDENTIAL', $4, now())`,
    [standardCaseId, confidentialCaseId, ORGANIZATION_ID, FULL_USER_ID],
  );

  const standardFileId = randomUUID();
  const confidentialFileId = randomUUID();
  await pool.query(
    `INSERT INTO files
      (id, organization_id, storage_provider, storage_bucket, storage_key, original_filename,
       mime_type, extension, size_bytes, checksum_sha256, uploaded_by, upload_source,
       virus_scan_status, status, updated_at)
     VALUES ($1, $3, 'dashboard-integration', 'fixture', $4, 'padrao.txt', 'text/plain',
             'txt', 10, $5, $6, 'INTEGRATION_TEST', 'CLEAN', 'AVAILABLE', now()),
            ($2, $3, 'dashboard-integration', 'fixture', $7, 'confidencial.txt', 'text/plain',
             'txt', 10, $8, $6, 'INTEGRATION_TEST', 'CLEAN', 'AVAILABLE', now())`,
    [
      standardFileId,
      confidentialFileId,
      ORGANIZATION_ID,
      `dashboard/${standardFileId}`,
      checksum(standardFileId),
      FULL_USER_ID,
      `dashboard/${confidentialFileId}`,
      checksum(confidentialFileId),
    ],
  );

  const standardDocumentId = randomUUID();
  const confidentialDocumentId = randomUUID();
  await pool.query(
    `INSERT INTO documents
      (id, organization_id, case_id, file_id, title, processing_status, updated_at)
     VALUES ($1, $3, $4, $5, 'Documento padrão fictício', 'NEEDS_REVIEW', now()),
            ($2, $3, $6, $7, 'Documento confidencial fictício', 'PROCESSING', now())`,
    [
      standardDocumentId,
      confidentialDocumentId,
      ORGANIZATION_ID,
      standardCaseId,
      standardFileId,
      confidentialCaseId,
      confidentialFileId,
    ],
  );

  await pool.query(
    `INSERT INTO tasks
      (id, organization_id, case_id, title, task_type, status, priority, created_by,
       due_at, updated_at)
     VALUES ($1, $3, $4, 'Tarefa padrão fictícia', 'TEST', 'OPEN', 'NORMAL', $5,
             '2025-01-01T00:00:00.000Z', now()),
            ($2, $3, $6, 'Tarefa confidencial fictícia', 'TEST', 'IN_PROGRESS', 'HIGH', $5,
             '2030-01-01T00:00:00.000Z', now())`,
    [randomUUID(), randomUUID(), ORGANIZATION_ID, standardCaseId, FULL_USER_ID, confidentialCaseId],
  );
  await pool.query(
    `INSERT INTO processing_jobs
      (id, organization_id, case_id, file_id, document_id, job_type, status,
       error_code, error_message, started_at, finished_at, updated_at)
     VALUES ($1, $3, $4, $5, $6, 'OCR', 'FAILED', 'FIXTURE_FAILURE',
             'Falha segura fictícia.', now(), now(), now()),
            ($2, $3, $7, $8, $9, 'OCR', 'PROCESSING', NULL, NULL, now(), NULL, now())`,
    [
      randomUUID(),
      randomUUID(),
      ORGANIZATION_ID,
      standardCaseId,
      standardFileId,
      standardDocumentId,
      confidentialCaseId,
      confidentialFileId,
      confidentialDocumentId,
    ],
  );
}

async function login(email) {
  const response = await request(http)
    .post('/api/v1/auth/login')
    .send({ organizationSlug: 'lex-os-demonstracao', email, password: seedPassword })
    .expect(200);
  return response.body.accessToken;
}

before(async () => {
  await cleanup();
  await setupFixtures();
  const [{ AppModule }, { configureHttpPlatform }, { loadRuntimeConfig }] = await Promise.all([
    import('../../dist/app.module.js'),
    import('../../dist/http/http-platform.js'),
    import('@lex-os/config'),
  ]);
  app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  configureHttpPlatform(app, loadRuntimeConfig());
  await app.init();
  http = app.getHttpServer();
  fullToken = await login(FULL_EMAIL);
  standardToken = await login(STANDARD_EMAIL);
});

after(async () => {
  await app?.close();
  await cleanup();
  await pool.end();
});

describe('Delivery 10 dashboard summary', () => {
  it('publishes one aggregate route and requires every represented resource permission', async () => {
    const openApi = await request(http).get('/api/v1/docs/openapi.json').expect(200);
    assert.ok(openApi.body.paths['/api/v1/dashboard/summary']?.get);
    await request(http).get('/api/v1/dashboard/summary').expect(401);
  });

  it('summarizes accessible rows in PostgreSQL without leaking confidential counts', async () => {
    const full = await request(http)
      .get('/api/v1/dashboard/summary')
      .set('authorization', `Bearer ${fullToken}`)
      .expect(200);
    assert.deepEqual(full.body.cases, {
      total: 2,
      open: 2,
      highPriority: 1,
      processingLimitReached: 0,
    });
    assert.deepEqual(full.body.documents, {
      total: 2,
      processing: 1,
      needsReview: 1,
      failed: 0,
    });
    assert.deepEqual(full.body.tasks, { open: 2, overdue: 1 });
    assert.deepEqual(full.body.processing, { active: 1, failed: 1 });

    const standard = await request(http)
      .get('/api/v1/dashboard/summary')
      .set('authorization', `Bearer ${standardToken}`)
      .expect(200);
    assert.deepEqual(standard.body.cases, {
      total: 1,
      open: 1,
      highPriority: 0,
      processingLimitReached: 0,
    });
    assert.deepEqual(standard.body.documents, {
      total: 1,
      processing: 0,
      needsReview: 1,
      failed: 0,
    });
    assert.deepEqual(standard.body.tasks, { open: 1, overdue: 1 });
    assert.deepEqual(standard.body.processing, { active: 0, failed: 1 });
  });

  it('audits the confidential aggregate without case text', async () => {
    const result = await pool.query(
      `SELECT new_data
       FROM audit_logs
       WHERE organization_id = $1
         AND action = 'case.confidential.read'
         AND new_data ->> 'access' = 'DASHBOARD'
       ORDER BY created_at DESC
       LIMIT 1`,
      [ORGANIZATION_ID],
    );
    assert.equal(result.rowCount, 1);
    assert.deepEqual(result.rows[0].new_data, { access: 'DASHBOARD', count: 1 });
  });
});
