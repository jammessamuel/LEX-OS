const assert = require('node:assert/strict');
const path = require('node:path');
const { after, before, beforeEach, describe, it } = require('node:test');

const { NestFactory } = require('@nestjs/core');
const { Pool } = require('pg');
const request = require('supertest');

process.loadEnvFile(path.resolve(__dirname, '../../../../.env'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_HOST = '127.0.0.1';
process.env.DATABASE_PORT = '5433';
process.env.REDIS_HOST = '127.0.0.1';
process.env.PROCESSING_QUEUE_PREFIX = 'lex-os-password-reset-integration';

const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION_SLUG = 'lex-os-demonstracao';
const ADMIN_USER_ID = '00000000-0000-4000-8000-000000000002';
const MEMBER_ID = '13000000-0000-4000-8000-000000000001';
const MEMBER_EMAIL = 'd13-membro@lexos.invalid';
const BLOCKED_ID = '13000000-0000-4000-8000-000000000002';
const BLOCKED_EMAIL = 'd13-bloqueada@lexos.invalid';
const NEW_PASSWORD = 'nova-frase-ficticia-13';

const databaseUrl = process.env.DATABASE_URL;
const seedPassword = process.env.SEED_ADMIN_PASSWORD;
if (databaseUrl === undefined || seedPassword === undefined) {
  throw new Error('DATABASE_URL and SEED_ADMIN_PASSWORD are required for API integration tests.');
}

const pool = new Pool({ connectionString: databaseUrl });
let app;
let http;

async function cleanup() {
  for (const id of [MEMBER_ID, BLOCKED_ID]) {
    await pool.query('DELETE FROM password_reset_requests WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM email_outbox WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM refresh_sessions WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM audit_logs WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM user_roles WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
  }
}

async function createPerson(id, email, status) {
  await pool.query(
    `INSERT INTO users
      (id, organization_id, name, email, password_hash, status, updated_at)
     SELECT $1, $2, 'Pessoa Fictícia D13', $3, password_hash, $4::user_status, now()
     FROM users WHERE id = $5`,
    [id, ORGANIZATION_ID, email, status, ADMIN_USER_ID],
  );
}

const login = (email, password = seedPassword) =>
  request(http)
    .post('/api/v1/auth/login')
    .send({ organizationSlug: ORGANIZATION_SLUG, email, password });

const requestReset = (email, slug = ORGANIZATION_SLUG) =>
  request(http).post('/api/v1/auth/password-reset').send({ organizationSlug: slug, email });

async function openRequestsFor(userId) {
  const rows = await pool.query(
    'SELECT token_hash FROM password_reset_requests WHERE user_id = $1 AND used_at IS NULL',
    [userId],
  );
  return rows.rows;
}

async function tokenFromOutbox(userId) {
  const outbox = await pool.query('SELECT payload FROM email_outbox WHERE user_id = $1', [userId]);
  return new URL(outbox.rows[0].payload.link).searchParams.get('token');
}

async function restoreMemberPassword() {
  await pool.query(
    'UPDATE users SET password_hash = (SELECT password_hash FROM users WHERE id = $2) WHERE id = $1',
    [MEMBER_ID, ADMIN_USER_ID],
  );
}

before(async () => {
  await cleanup();
  await createPerson(MEMBER_ID, MEMBER_EMAIL, 'ACTIVE');
  await createPerson(BLOCKED_ID, BLOCKED_EMAIL, 'BLOCKED');
  const [{ AppModule }, { configureHttpPlatform }, { loadRuntimeConfig }] = await Promise.all([
    import('../../dist/app.module.js'),
    import('../../dist/http/http-platform.js'),
    import('@lex-os/config'),
  ]);
  app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  configureHttpPlatform(app, loadRuntimeConfig());
  await app.init();
  http = app.getHttpServer();
});

after(async () => {
  await app?.close();
  await cleanup();
  await pool.end();
});

describe('Delivery 13 password recovery', () => {
  beforeEach(async () => {
    await pool.query('DELETE FROM password_reset_requests WHERE user_id IN ($1, $2)', [
      MEMBER_ID,
      BLOCKED_ID,
    ]);
    await pool.query('DELETE FROM email_outbox WHERE user_id IN ($1, $2)', [MEMBER_ID, BLOCKED_ID]);
  });

  it('answers the same for an unknown, a blocked, and a real address', async () => {
    await requestReset('nao-existe@lexos.invalid').expect(204);
    await requestReset(BLOCKED_EMAIL).expect(204);
    await requestReset(MEMBER_EMAIL).expect(204);
    await requestReset(MEMBER_EMAIL, 'escritorio-inexistente').expect(204);

    // Só a pessoa ativa gerou pedido: as demais receberam o mesmo silêncio.
    assert.equal((await openRequestsFor(MEMBER_ID)).length, 1);
    assert.equal((await openRequestsFor(BLOCKED_ID)).length, 0);
  });

  it('queues the message in the outbox instead of sending inside the request', async () => {
    await requestReset(MEMBER_EMAIL).expect(204);

    const rows = await pool.query(
      'SELECT template_id, status, payload, recipient FROM email_outbox WHERE user_id = $1',
      [MEMBER_ID],
    );
    assert.equal(rows.rows.length, 1);
    assert.equal(rows.rows[0].template_id, 'password-reset');
    assert.equal(rows.rows[0].status, 'PENDING');
    assert.equal(rows.rows[0].recipient, MEMBER_EMAIL);
    assert.match(rows.rows[0].payload.link, /\/nova-senha\?token=/u);
  });

  it('never stores the token in clear text, in the request or in the outbox', async () => {
    await requestReset(MEMBER_EMAIL).expect(204);

    const stored = await openRequestsFor(MEMBER_ID);
    assert.match(stored[0].token_hash, /^[0-9a-f]{64}$/u);

    const token = await tokenFromOutbox(MEMBER_ID);
    assert.ok(token);
    assert.notEqual(token, stored[0].token_hash);

    // O corpo nunca é guardado: a caixa leva modelo e dados, não a mensagem renderizada.
    const outbox = await pool.query('SELECT payload FROM email_outbox WHERE user_id = $1', [
      MEMBER_ID,
    ]);
    assert.equal(Object.hasOwn(outbox.rows[0].payload, 'text'), false);
  });

  it('resets the password and drops every open session of that person', async () => {
    const before = await login(MEMBER_EMAIL).expect(200);
    assert.ok(before.body.accessToken);

    await requestReset(MEMBER_EMAIL).expect(204);
    const token = await tokenFromOutbox(MEMBER_ID);

    await request(http)
      .post('/api/v1/auth/password-reset/complete')
      .send({ token, password: NEW_PASSWORD })
      .expect(204);

    const sessions = await pool.query(
      'SELECT revoked_at, revocation_reason FROM refresh_sessions WHERE user_id = $1',
      [MEMBER_ID],
    );
    assert.ok(sessions.rows.length >= 1);
    assert.ok(sessions.rows.every((row) => row.revoked_at !== null));
    assert.ok(sessions.rows.every((row) => row.revocation_reason === 'PASSWORD_RESET'));

    await login(MEMBER_EMAIL).expect(401);
    await login(MEMBER_EMAIL, NEW_PASSWORD).expect(200);

    await restoreMemberPassword();
  });

  it('spends the token on first use and refuses the replay', async () => {
    await requestReset(MEMBER_EMAIL).expect(204);
    const token = await tokenFromOutbox(MEMBER_ID);

    await request(http)
      .post('/api/v1/auth/password-reset/complete')
      .send({ token, password: NEW_PASSWORD })
      .expect(204);
    const replay = await request(http)
      .post('/api/v1/auth/password-reset/complete')
      .send({ token, password: 'outra-frase-ficticia-13' })
      .expect(401);
    assert.equal(replay.body.code, 'PASSWORD_RESET_INVALID');

    await restoreMemberPassword();
  });

  it('a new request invalidates the previous open one', async () => {
    await requestReset(MEMBER_EMAIL).expect(204);
    await requestReset(MEMBER_EMAIL).expect(204);

    // Dois links vivos para a mesma conta dobram a superfície sem dobrar a utilidade.
    assert.equal((await openRequestsFor(MEMBER_ID)).length, 1);
  });

  it('refuses an expired token with the same message as an unknown one', async () => {
    await requestReset(MEMBER_EMAIL).expect(204);
    const token = await tokenFromOutbox(MEMBER_ID);
    await pool.query(
      "UPDATE password_reset_requests SET expires_at = now() - interval '1 hour' WHERE user_id = $1",
      [MEMBER_ID],
    );

    const expired = await request(http)
      .post('/api/v1/auth/password-reset/complete')
      .send({ token, password: NEW_PASSWORD })
      .expect(401);
    const unknown = await request(http)
      .post('/api/v1/auth/password-reset/complete')
      .send({ token: 'z'.repeat(43), password: NEW_PASSWORD })
      .expect(401);

    assert.equal(expired.body.code, unknown.body.code);
    assert.equal(expired.body.message, unknown.body.message);
  });

  it('audits the recovery without the token, the password, or the address', async () => {
    await requestReset(MEMBER_EMAIL).expect(204);

    const audits = await pool.query(
      `SELECT action, new_data FROM audit_logs
       WHERE user_id = $1 AND action LIKE 'auth.password.%'`,
      [MEMBER_ID],
    );
    assert.equal(audits.rows.length, 1);
    assert.equal(audits.rows[0].action, 'auth.password.reset.requested');
    const serialized = JSON.stringify(audits.rows);
    assert.equal(serialized.includes(NEW_PASSWORD), false);
    assert.equal(serialized.includes(MEMBER_EMAIL), false);
  });
});
