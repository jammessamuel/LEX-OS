const assert = require('node:assert/strict');
const path = require('node:path');
const { after, before, describe, it } = require('node:test');

const { NestFactory } = require('@nestjs/core');
const { Pool } = require('pg');
const { createClient } = require('redis');
const request = require('supertest');

process.loadEnvFile(path.resolve(__dirname, '../../../../.env'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_HOST = '127.0.0.1';
process.env.DATABASE_PORT = '5433';
process.env.REDIS_HOST = '127.0.0.1';
process.env.PROCESSING_QUEUE_PREFIX = 'lex-os-auth-integration';

const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
const ADMIN_USER_ID = '00000000-0000-4000-8000-000000000002';
const UNAUTHORIZED_USER_ID = '20000000-0000-4000-8000-000000000001';
const ADMIN_EMAIL = 'admin@lexos.invalid';
const UNAUTHORIZED_EMAIL = 'no-permission@lexos.invalid';

const databaseUrl = process.env.DATABASE_URL;
const seedPassword = process.env.SEED_ADMIN_PASSWORD;

if (databaseUrl === undefined || seedPassword === undefined) {
  throw new Error('DATABASE_URL and SEED_ADMIN_PASSWORD are required for API integration tests.');
}

const pool = new Pool({ connectionString: databaseUrl });
const redis = createClient({
  password: process.env.REDIS_PASSWORD,
  socket: { host: '127.0.0.1', port: Number(process.env.REDIS_PORT ?? 6379) },
});
redis.on('error', () => undefined);

let app;
let http;
const issuedSecrets = [];

function cookieFrom(response) {
  const values = response.headers['set-cookie'];
  assert.ok(Array.isArray(values) && values.length > 0, 'Expected a Set-Cookie header.');
  return values[0].split(';')[0];
}

function refreshTokenFromCookie(cookie) {
  return cookie.slice(cookie.indexOf('=') + 1);
}

function sessionIdFromAccessToken(accessToken) {
  const payload = accessToken.split('.')[1];
  assert.ok(payload);
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).sid;
}

async function clearAuthRateLimitKeys() {
  let cursor = '0';

  do {
    const result = await redis.scan(cursor, { MATCH: 'auth:login:*', COUNT: 100 });
    cursor = result.cursor;
    if (result.keys.length > 0) {
      await redis.del(result.keys);
    }
  } while (cursor !== '0');
}

async function login(email = ADMIN_EMAIL, password = seedPassword) {
  return request(http)
    .post('/api/v1/auth/login')
    .set('x-request-id', `test-login-${Date.now()}`)
    .send({ organizationId: ORGANIZATION_ID, email, password });
}

async function cleanup() {
  await pool.query(
    `DELETE FROM audit_logs
     WHERE organization_id = $1 AND (action LIKE 'auth.%' OR user_id = $2)`,
    [ORGANIZATION_ID, UNAUTHORIZED_USER_ID],
  );
  await pool.query('DELETE FROM refresh_sessions WHERE organization_id = $1', [ORGANIZATION_ID]);
  await pool.query('DELETE FROM users WHERE id = $1', [UNAUTHORIZED_USER_ID]);
  await pool.query(
    `UPDATE users SET status = 'ACTIVE', deleted_at = NULL, last_login_at = NULL, updated_at = now()
     WHERE id = $1 AND organization_id = $2`,
    [ADMIN_USER_ID, ORGANIZATION_ID],
  );
  await clearAuthRateLimitKeys();
}

before(async () => {
  await redis.connect();
  await cleanup();
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
  await cleanup();
  await app?.close();
  if (redis.isOpen) {
    redis.destroy();
  }
  await pool.end();
});

describe('Delivery 4 HTTP and authentication contract', () => {
  it('publishes OpenAPI for only the implemented HTTP surface', async () => {
    const response = await request(http).get('/api/v1/docs/openapi.json').expect(200);

    assert.ok(response.body.paths['/api/v1/auth/login']);
    assert.ok(response.body.paths['/api/v1/auth/refresh']);
    assert.ok(response.body.paths['/api/v1/auth/logout']);
    assert.ok(response.body.paths['/api/v1/organizations/current']);
    assert.ok(response.body.paths['/api/v1/cases']);
    assert.ok(response.body.paths['/api/v1/files/{id}/download-url']);
    assert.ok(response.body.paths['/api/v1/documents/{id}/reprocess']?.post);
    assert.ok(response.body.paths['/api/v1/processing-jobs']?.get);
  });

  it('returns the stable validation error envelope without echoing rejected values', async () => {
    const response = await request(http)
      .post('/api/v1/auth/login')
      .send({
        organizationId: ORGANIZATION_ID,
        email: 'invalid-email',
        password: seedPassword,
        tenantId: 'spoofed',
      })
      .expect(400);

    assert.equal(response.body.statusCode, 400);
    assert.equal(response.body.code, 'VALIDATION_ERROR');
    assert.equal(response.body.message, 'Dados inválidos.');
    assert.ok(Array.isArray(response.body.details));
    assert.equal(JSON.stringify(response.body).includes(seedPassword), false);
    assert.equal(typeof response.body.requestId, 'string');
  });

  it('logs in, updates last login, and keeps the refresh secret in an HttpOnly cookie', async () => {
    const response = await login().then((result) => {
      assert.equal(result.status, 200);
      return result;
    });
    const setCookie = response.headers['set-cookie'][0];
    const cookie = cookieFrom(response);
    const refreshToken = refreshTokenFromCookie(cookie);
    issuedSecrets.push(response.body.accessToken, refreshToken);

    assert.equal(response.body.tokenType, 'Bearer');
    assert.equal(response.body.user.email, ADMIN_EMAIL);
    assert.equal(response.body.organization.id, ORGANIZATION_ID);
    assert.ok(response.body.permissions.includes('cases.read'));
    assert.ok(response.body.permissions.includes('documents.read'));
    assert.deepEqual(response.body.permissions, [...new Set(response.body.permissions)].sort());
    assert.equal('refreshToken' in response.body, false);
    assert.match(setCookie, /HttpOnly/u);
    assert.match(setCookie, /SameSite=Strict/u);
    assert.match(setCookie, /Path=\/api\/v1\/auth/u);

    const sessionId = sessionIdFromAccessToken(response.body.accessToken);
    const stored = await pool.query(
      `SELECT token_hash, last_login_at
       FROM refresh_sessions JOIN users ON users.id = refresh_sessions.user_id
       WHERE refresh_sessions.id = $1`,
      [sessionId],
    );
    assert.match(stored.rows[0].token_hash.trim(), /^[0-9a-f]{64}$/u);
    assert.notEqual(stored.rows[0].token_hash.trim(), refreshToken);
    assert.ok(stored.rows[0].last_login_at);
  });

  it('does not distinguish invalid credentials from a blocked user', async () => {
    const invalid = await login(ADMIN_EMAIL, 'invalid-password').then((result) => result);
    assert.equal(invalid.status, 401);

    await pool.query("UPDATE users SET status = 'BLOCKED', updated_at = now() WHERE id = $1", [
      ADMIN_USER_ID,
    ]);

    try {
      const blocked = await login().then((result) => result);
      assert.equal(blocked.status, 401);
      assert.equal(blocked.body.code, invalid.body.code);
      assert.equal(blocked.body.message, invalid.body.message);
    } finally {
      await pool.query("UPDATE users SET status = 'ACTIVE', updated_at = now() WHERE id = $1", [
        ADMIN_USER_ID,
      ]);
    }
  });

  it('derives the current organization from the access token and ignores spoofed tenant input', async () => {
    const authenticated = await login();
    assert.equal(authenticated.status, 200);
    const response = await request(http)
      .get('/api/v1/organizations/current?organizationId=ffffffff-ffff-4fff-8fff-ffffffffffff')
      .set('authorization', `Bearer ${authenticated.body.accessToken}`)
      .set('x-organization-id', 'ffffffff-ffff-4fff-8fff-ffffffffffff')
      .expect(200);

    assert.equal(response.body.id, ORGANIZATION_ID);
    assert.equal(response.body.tradeName, 'Lex OS Demonstração');
  });

  it('rotates refresh tokens and revokes the family when an old token is replayed', async () => {
    const authenticated = await login();
    const firstCookie = cookieFrom(authenticated);
    const firstSessionId = sessionIdFromAccessToken(authenticated.body.accessToken);
    const family = await pool.query('SELECT token_family_id FROM refresh_sessions WHERE id = $1', [
      firstSessionId,
    ]);
    const tokenFamilyId = family.rows[0].token_family_id;
    const rotated = await request(http)
      .post('/api/v1/auth/refresh')
      .set('Cookie', firstCookie)
      .expect(200);
    const secondCookie = cookieFrom(rotated);
    issuedSecrets.push(
      refreshTokenFromCookie(firstCookie),
      refreshTokenFromCookie(secondCookie),
      rotated.body.accessToken,
    );

    assert.notEqual(secondCookie, firstCookie);
    assert.deepEqual(rotated.body.permissions, authenticated.body.permissions);
    await request(http).post('/api/v1/auth/refresh').set('Cookie', firstCookie).expect(401);
    await request(http).post('/api/v1/auth/refresh').set('Cookie', secondCookie).expect(401);

    const active = await pool.query(
      'SELECT count(*)::int AS count FROM refresh_sessions WHERE token_family_id = $1 AND revoked_at IS NULL',
      [tokenFamilyId],
    );
    assert.equal(active.rows[0].count, 0);
  });

  it('revokes the authenticated session family on logout', async () => {
    const authenticated = await login();
    const accessToken = authenticated.body.accessToken;

    const response = await request(http)
      .post('/api/v1/auth/logout')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(204);
    assert.match(response.headers['set-cookie'][0], /lex_os_refresh=;/u);

    await request(http)
      .get('/api/v1/organizations/current')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(401);
  });

  it('authorizes by permission rather than role name', async () => {
    const passwordHash = await pool.query('SELECT password_hash FROM users WHERE id = $1', [
      ADMIN_USER_ID,
    ]);
    await pool.query(
      `INSERT INTO users
        (id, organization_id, name, email, password_hash, status, updated_at)
       VALUES ($1, $2, 'Usuário sem permissão', $3, $4, 'ACTIVE', now())`,
      [
        UNAUTHORIZED_USER_ID,
        ORGANIZATION_ID,
        UNAUTHORIZED_EMAIL,
        passwordHash.rows[0].password_hash,
      ],
    );

    const authenticated = await login(UNAUTHORIZED_EMAIL);
    assert.equal(authenticated.status, 200);
    await request(http)
      .get('/api/v1/organizations/current')
      .set('authorization', `Bearer ${authenticated.body.accessToken}`)
      .expect(403);
  });

  it('blocks repeated credential attempts using the Redis-backed brute-force policy', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await login('rate-limit@lexos.invalid', 'invalid-password');
      assert.equal(response.status, 401);
    }

    const blocked = await login('rate-limit@lexos.invalid', 'invalid-password');
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.code, 'AUTH_RATE_LIMITED');
  });

  it('keeps passwords and issued tokens out of authentication audits', async () => {
    const audits = await pool.query(
      `SELECT coalesce(old_data::text, '') || coalesce(new_data::text, '') AS data
       FROM audit_logs WHERE organization_id = $1 AND action LIKE 'auth.%'`,
      [ORGANIZATION_ID],
    );
    const serialized = audits.rows.map((row) => row.data).join('\n');

    assert.ok(audits.rowCount > 0);
    assert.equal(serialized.includes(seedPassword), false);
    assert.equal(serialized.includes('invalid-password'), false);
    for (const secret of issuedSecrets) {
      assert.equal(serialized.includes(secret), false);
    }
  });
});
