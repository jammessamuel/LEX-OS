const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
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
process.env.PROCESSING_QUEUE_PREFIX = 'lex-os-audit-integration';

const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
const ADMIN_USER_ID = '00000000-0000-4000-8000-000000000002';
const ADMIN_EMAIL = 'admin@lexos.invalid';
const AUDIT_ONLY_ROLE_ID = '91000000-0000-4000-8000-000000000001';
const AUDIT_ONLY_USER_ID = '91000000-0000-4000-8000-000000000002';
const AUDIT_ONLY_EMAIL = 'd10-audit-only@lexos.invalid';
const OTHER_ORGANIZATION_ID = '91000000-0000-4000-8000-000000000003';
const FIXTURE_ACTION = 'audit.fixture.visible';

const databaseUrl = process.env.DATABASE_URL;
const seedPassword = process.env.SEED_ADMIN_PASSWORD;
if (databaseUrl === undefined || seedPassword === undefined) {
  throw new Error('DATABASE_URL and SEED_ADMIN_PASSWORD are required for audit integration tests.');
}

const pool = new Pool({ connectionString: databaseUrl });
const fixtureIds = [];
let app;
let http;
let adminToken;
let auditOnlyToken;

async function cleanup() {
  await pool.query(
    `DELETE FROM audit_logs
     WHERE action IN ($1, 'audit.log.listed')
        OR user_id = $2
        OR organization_id = $3`,
    [FIXTURE_ACTION, AUDIT_ONLY_USER_ID, OTHER_ORGANIZATION_ID],
  );
  await pool.query('DELETE FROM refresh_sessions WHERE user_id IN ($1, $2)', [
    ADMIN_USER_ID,
    AUDIT_ONLY_USER_ID,
  ]);
  await pool.query('DELETE FROM user_roles WHERE user_id = $1', [AUDIT_ONLY_USER_ID]);
  await pool.query('DELETE FROM role_permissions WHERE role_id = $1', [AUDIT_ONLY_ROLE_ID]);
  await pool.query('DELETE FROM users WHERE id = $1', [AUDIT_ONLY_USER_ID]);
  await pool.query('DELETE FROM roles WHERE id = $1', [AUDIT_ONLY_ROLE_ID]);
  await pool.query('DELETE FROM organizations WHERE id = $1', [OTHER_ORGANIZATION_ID]);
}

async function setupFixtures() {
  await pool.query(
    `INSERT INTO users
      (id, organization_id, name, email, password_hash, status, updated_at)
     SELECT $1, $2, 'Auditor sem confidencial Fictício', $3, password_hash, 'ACTIVE', now()
     FROM users WHERE id = $4`,
    [AUDIT_ONLY_USER_ID, ORGANIZATION_ID, AUDIT_ONLY_EMAIL, ADMIN_USER_ID],
  );
  await pool.query(
    `INSERT INTO roles (id, organization_id, name, code, description, updated_at)
     VALUES ($1, $2, 'Auditoria sem confidencial', 'D10_AUDIT_ONLY',
             'Papel fictício de teste.', now())`,
    [AUDIT_ONLY_ROLE_ID, ORGANIZATION_ID],
  );
  await pool.query(
    `INSERT INTO role_permissions (role_id, permission_id)
     SELECT $1, id FROM permissions WHERE code = 'audit.read'`,
    [AUDIT_ONLY_ROLE_ID],
  );
  await pool.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [
    AUDIT_ONLY_USER_ID,
    AUDIT_ONLY_ROLE_ID,
  ]);
  await pool.query(
    `INSERT INTO organizations
      (id, legal_name, trade_name, document_number, subscription_plan, updated_at)
     VALUES ($1, 'Organização Externa Auditoria', 'Externa Auditoria', 'AUDIT-OTHER', 'TEST', now())`,
    [OTHER_ORGANIZATION_ID],
  );

  for (const [index, createdAt] of [
    '2026-08-13T12:00:00.000Z',
    '2026-08-13T12:01:00.000Z',
    '2026-08-13T12:02:00.000Z',
  ].entries()) {
    const id = randomUUID();
    fixtureIds.push(id);
    await pool.query(
      `INSERT INTO audit_logs
        (id, organization_id, user_id, actor_type, actor_id, action, entity_type,
         entity_id, old_data, new_data, request_id, correlation_id, created_at)
       VALUES ($1, $2, $3, 'USER', $9, $4, 'task', $5,
               '{"unsafe":"segredo-antigo"}', '{"unsafe":"segredo-novo"}',
               $6, $7, $8)`,
      [
        id,
        ORGANIZATION_ID,
        ADMIN_USER_ID,
        FIXTURE_ACTION,
        randomUUID(),
        `audit-request-${index}`,
        `audit-correlation-${index}`,
        createdAt,
        ADMIN_USER_ID,
      ],
    );
  }

  await pool.query(
    `INSERT INTO audit_logs
      (id, organization_id, actor_type, actor_id, action, entity_type, created_at)
     VALUES ($1, $2, 'SYSTEM', 'fixture', $3, 'task', '2026-08-13T12:03:00.000Z')`,
    [randomUUID(), OTHER_ORGANIZATION_ID, FIXTURE_ACTION],
  );
}

async function login(email) {
  const response = await request(http)
    .post('/api/v1/auth/login')
    .send({ organizationSlug: 'lex-os-demonstracao', email, password: seedPassword })
    .expect(200);
  return response.body.accessToken;
}

function authorized(url, token = adminToken) {
  return request(http).get(url).set('authorization', `Bearer ${token}`);
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
  adminToken = await login(ADMIN_EMAIL);
  auditOnlyToken = await login(AUDIT_ONLY_EMAIL);
});

after(async () => {
  await app?.close();
  await cleanup();
  await pool.end();
});

describe('Delivery 10 authorized audit trail', () => {
  it('publishes the route and requires audit plus confidential-case permissions', async () => {
    const openApi = await request(http).get('/api/v1/docs/openapi.json').expect(200);
    assert.ok(openApi.body.paths['/api/v1/audit-logs']?.get);

    await authorized(`/api/v1/audit-logs?action=${FIXTURE_ACTION}`, auditOnlyToken).expect(403);
    await request(http).get('/api/v1/audit-logs').expect(401);
  });

  it('paginates only the current tenant and never returns stored snapshots', async () => {
    const first = await authorized(`/api/v1/audit-logs?action=${FIXTURE_ACTION}&limit=2`).expect(
      200,
    );
    assert.equal(first.body.data.length, 2);
    assert.equal(first.body.pageInfo.hasNextPage, true);
    assert.ok(first.body.pageInfo.nextCursor);
    assert.deepEqual(
      first.body.data.map((entry) => entry.id),
      [fixtureIds[2], fixtureIds[1]],
    );
    assert.deepEqual(first.body.data[0].actor, {
      id: ADMIN_USER_ID,
      name: 'Administrador Fictício',
    });
    assert.equal(JSON.stringify(first.body).includes('segredo-'), false);
    assert.equal('oldData' in first.body.data[0], false);
    assert.equal('newData' in first.body.data[0], false);

    const second = await authorized(
      `/api/v1/audit-logs?action=${FIXTURE_ACTION}&limit=2&cursor=${first.body.pageInfo.nextCursor}`,
    ).expect(200);
    assert.deepEqual(
      second.body.data.map((entry) => entry.id),
      [fixtureIds[0]],
    );
    assert.equal(second.body.pageInfo.hasNextPage, false);
    assert.equal(second.body.pageInfo.nextCursor, null);
  });

  it('validates filters and audits the sensitive read without returning its payload', async () => {
    await authorized(
      '/api/v1/audit-logs?from=2026-08-14T00:00:00.000Z&to=2026-08-13T00:00:00.000Z',
    ).expect(400);
    await authorized('/api/v1/audit-logs?action=INVALID ACTION').expect(400);

    const result = await pool.query(
      `SELECT new_data
       FROM audit_logs
       WHERE organization_id = $1 AND action = 'audit.log.listed'
       ORDER BY created_at DESC
       LIMIT 1`,
      [ORGANIZATION_ID],
    );
    assert.equal(result.rowCount, 1);
    assert.equal(typeof result.rows[0].new_data.count, 'number');
    assert.equal(JSON.stringify(result.rows[0].new_data).includes('segredo-'), false);
  });
});
