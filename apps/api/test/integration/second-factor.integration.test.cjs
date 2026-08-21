const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const path = require('node:path');
const { after, before, beforeEach, describe, it } = require('node:test');

const { NestFactory } = require('@nestjs/core');
const { Pool } = require('pg');
const { createClient } = require('redis');
const request = require('supertest');

process.loadEnvFile(path.resolve(__dirname, '../../../../.env'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_HOST = '127.0.0.1';
process.env.DATABASE_PORT = '5433';
process.env.REDIS_HOST = '127.0.0.1';
process.env.PROCESSING_QUEUE_PREFIX = 'lex-os-second-factor-integration';

const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION_SLUG = 'lex-os-demonstracao';
const ADMIN_USER_ID = '00000000-0000-4000-8000-000000000002';
const MEMBER_ID = '14000000-0000-4000-8000-000000000001';
const MEMBER_EMAIL = 'd14-membro@lexos.invalid';

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
let token;

/**
 * Gera o código do jeito que o aplicativo autenticador geraria. O teste precisa provar posse
 * do segredo, e o segredo só sai na resposta da inscrição — é o mesmo caminho de uma pessoa.
 */
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function decodeBase32(value) {
  let bits = 0;
  let accumulator = 0;
  const bytes = [];
  for (const character of value) {
    accumulator = (accumulator << 5) | BASE32.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      bytes.push((accumulator >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function codeFor(secret, atMs = Date.now()) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(atMs / 1000 / 30)));
  const digest = createHmac('sha1', decodeBase32(secret)).update(counter).digest();
  const offset = digest.at(-1) & 0x0f;
  return String((digest.readUInt32BE(offset) & 0x7fff_ffff) % 1_000_000).padStart(6, '0');
}

async function clearTotpCounters() {
  let cursor = '0';
  do {
    const result = await redis.scan(cursor, { MATCH: 'auth:totp:*', COUNT: 100 });
    cursor = result.cursor;
    if (result.keys.length > 0) {
      await redis.del(result.keys);
    }
  } while (cursor !== '0');
}

async function cleanup() {
  await pool.query('DELETE FROM totp_recovery_codes WHERE user_id = $1', [MEMBER_ID]);
  await pool.query('DELETE FROM refresh_sessions WHERE user_id = $1', [MEMBER_ID]);
  await pool.query('DELETE FROM audit_logs WHERE user_id = $1', [MEMBER_ID]);
  await pool.query('DELETE FROM user_roles WHERE user_id = $1', [MEMBER_ID]);
  await pool.query('DELETE FROM users WHERE id = $1', [MEMBER_ID]);
  await pool.query('UPDATE organizations SET require_second_factor = false WHERE id = $1', [
    ORGANIZATION_ID,
  ]);
}

const authed = (method, url) => request(http)[method](url).set('Authorization', `Bearer ${token}`);

before(async () => {
  await cleanup();
  await pool.query(
    `INSERT INTO users
      (id, organization_id, name, email, password_hash, status, updated_at)
     SELECT $1, $2, 'Pessoa Fictícia D14', $3, password_hash, 'ACTIVE', now()
     FROM users WHERE id = $4`,
    [MEMBER_ID, ORGANIZATION_ID, MEMBER_EMAIL, ADMIN_USER_ID],
  );
  const [{ AppModule }, { configureHttpPlatform }, { loadRuntimeConfig }] = await Promise.all([
    import('../../dist/app.module.js'),
    import('../../dist/http/http-platform.js'),
    import('@lex-os/config'),
  ]);
  app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  configureHttpPlatform(app, loadRuntimeConfig());
  await app.init();
  http = app.getHttpServer();
  await redis.connect();

  const signedIn = await request(http)
    .post('/api/v1/auth/login')
    .send({ organizationSlug: ORGANIZATION_SLUG, email: MEMBER_EMAIL, password: seedPassword })
    .expect(200);
  token = signedIn.body.accessToken;
});

after(async () => {
  await app?.close();
  await cleanup();
  await clearTotpCounters();
  await redis.destroy();
  await pool.end();
});

describe('Delivery 14 second-factor enrolment', () => {
  beforeEach(async () => {
    await pool.query('DELETE FROM totp_recovery_codes WHERE user_id = $1', [MEMBER_ID]);
    await pool.query(
      'UPDATE users SET totp_secret = NULL, totp_activated_at = NULL, totp_last_step = NULL WHERE id = $1',
      [MEMBER_ID],
    );
    await pool.query('UPDATE organizations SET require_second_factor = false WHERE id = $1', [
      ORGANIZATION_ID,
    ]);
    await clearTotpCounters();
  });

  it('starts inactive and reports so', async () => {
    const status = await authed('get', '/api/v1/auth/second-factor').expect(200);

    assert.deepEqual(status.body, {
      active: false,
      requiredByOrganization: false,
      unusedRecoveryCodes: 0,
    });
  });

  it('does not activate on enrolment alone', async () => {
    const started = await authed('post', '/api/v1/auth/second-factor').expect(201);

    assert.match(started.body.secret, /^[A-Z2-7]{32}$/u);
    assert.match(started.body.uri, /^otpauth:\/\/totp\//u);

    // Gerar segredo não pode ligar o fator: quem começa e desiste ficaria trancado fora.
    const status = await authed('get', '/api/v1/auth/second-factor').expect(200);
    assert.equal(status.body.active, false);
  });

  it('stores the secret encrypted, so a database dump does not hand it over', async () => {
    const started = await authed('post', '/api/v1/auth/second-factor').expect(201);

    const stored = await pool.query('SELECT totp_secret FROM users WHERE id = $1', [MEMBER_ID]);
    assert.ok(stored.rows[0].totp_secret);
    assert.equal(stored.rows[0].totp_secret.includes(started.body.secret), false);
    // Formato iv:tag:conteudo, tudo em base64url.
    assert.match(stored.rows[0].totp_secret, /^[\w-]+:[\w-]+:[\w-]+$/u);
  });

  it('activates only with a valid code, and issues recovery codes once', async () => {
    const started = await authed('post', '/api/v1/auth/second-factor').expect(201);

    const refused = await authed('post', '/api/v1/auth/second-factor/activate')
      .send({ code: '000000' })
      .expect(401);
    assert.equal(refused.body.code, 'SECOND_FACTOR_CODE_INVALID');

    const activated = await authed('post', '/api/v1/auth/second-factor/activate')
      .send({ code: codeFor(started.body.secret) })
      .expect(200);
    assert.equal(activated.body.recoveryCodes.length, 10);

    const status = await authed('get', '/api/v1/auth/second-factor').expect(200);
    assert.equal(status.body.active, true);
    assert.equal(status.body.unusedRecoveryCodes, 10);
  });

  it('keeps recovery codes hashed, never in clear text', async () => {
    const started = await authed('post', '/api/v1/auth/second-factor').expect(201);
    const activated = await authed('post', '/api/v1/auth/second-factor/activate')
      .send({ code: codeFor(started.body.secret) })
      .expect(200);

    const stored = await pool.query(
      'SELECT code_hash FROM totp_recovery_codes WHERE user_id = $1',
      [MEMBER_ID],
    );
    const hashes = stored.rows.map((row) => row.code_hash);
    assert.equal(hashes.length, 10);
    for (const hash of hashes) {
      assert.match(hash, /^[0-9a-f]{64}$/u);
    }
    for (const code of activated.body.recoveryCodes) {
      assert.equal(hashes.includes(code), false);
    }
  });

  it('refuses to replace an active secret in silence', async () => {
    const started = await authed('post', '/api/v1/auth/second-factor').expect(201);
    await authed('post', '/api/v1/auth/second-factor/activate')
      .send({ code: codeFor(started.body.secret) })
      .expect(200);

    // Trocar de aparelho passa por desligar com um código, que prova posse do atual.
    const again = await authed('post', '/api/v1/auth/second-factor').expect(409);
    assert.equal(again.body.code, 'SECOND_FACTOR_ALREADY_ACTIVE');
  });

  it('requires a code to disable, so a stolen session cannot strip the factor', async () => {
    const started = await authed('post', '/api/v1/auth/second-factor').expect(201);
    await authed('post', '/api/v1/auth/second-factor/activate')
      .send({ code: codeFor(started.body.secret) })
      .expect(200);

    await authed('delete', '/api/v1/auth/second-factor').send({ code: '000000' }).expect(401);
    await authed('delete', '/api/v1/auth/second-factor')
      .send({ code: codeFor(started.body.secret) })
      .expect(204);

    const status = await authed('get', '/api/v1/auth/second-factor').expect(200);
    assert.equal(status.body.active, false);
    const codes = await pool.query(
      'SELECT count(*)::int AS count FROM totp_recovery_codes WHERE user_id = $1',
      [MEMBER_ID],
    );
    assert.equal(codes.rows[0].count, 0, 'recovery codes must go with the factor');
  });

  it('refuses to disable when the firm requires the second factor', async () => {
    const started = await authed('post', '/api/v1/auth/second-factor').expect(201);
    await authed('post', '/api/v1/auth/second-factor/activate')
      .send({ code: codeFor(started.body.secret) })
      .expect(200);
    await pool.query('UPDATE organizations SET require_second_factor = true WHERE id = $1', [
      ORGANIZATION_ID,
    ]);

    const refused = await authed('delete', '/api/v1/auth/second-factor')
      .send({ code: codeFor(started.body.secret) })
      .expect(409);
    assert.equal(refused.body.code, 'SECOND_FACTOR_REQUIRED_BY_ORGANIZATION');
  });

  it('counts wrong codes and blocks brute force', async () => {
    await authed('post', '/api/v1/auth/second-factor').expect(201);

    // Cinco tentativas por dez minutos: engano de digitação passa, varredura não.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await authed('post', '/api/v1/auth/second-factor/activate')
        .send({ code: '000000' })
        .expect(401);
    }
    const blocked = await authed('post', '/api/v1/auth/second-factor/activate')
      .send({ code: '000000' })
      .expect(429);
    assert.equal(blocked.body.code, 'AUTH_RATE_LIMITED');
  });

  it('audits enrolment and activation without the secret or the code', async () => {
    const started = await authed('post', '/api/v1/auth/second-factor').expect(201);
    await authed('post', '/api/v1/auth/second-factor/activate')
      .send({ code: codeFor(started.body.secret) })
      .expect(200);

    const audits = await pool.query(
      `SELECT action, new_data FROM audit_logs
       WHERE user_id = $1 AND action LIKE 'auth.second_factor.%' ORDER BY created_at`,
      [MEMBER_ID],
    );
    const actions = audits.rows.map((row) => row.action);
    assert.ok(actions.includes('auth.second_factor.enrolled'));
    assert.ok(actions.includes('auth.second_factor.activated'));
    const serialized = JSON.stringify(audits.rows);
    assert.equal(serialized.includes(started.body.secret), false);
  });

  it('rejects a malformed code at the boundary', async () => {
    await authed('post', '/api/v1/auth/second-factor').expect(201);

    for (const code of ['12345', 'abcdef', '']) {
      const response = await authed('post', '/api/v1/auth/second-factor/activate')
        .send({ code })
        .expect(400);
      assert.equal(response.body.code, 'VALIDATION_ERROR');
    }
  });
});

describe('Delivery 14 second factor at sign-in', () => {
  let secret;
  let recoveryCodes;

  const signIn = (body) =>
    request(http)
      .post('/api/v1/auth/login')
      .send({
        organizationSlug: ORGANIZATION_SLUG,
        email: MEMBER_EMAIL,
        password: seedPassword,
        ...body,
      });

  beforeEach(async () => {
    await pool.query('DELETE FROM totp_recovery_codes WHERE user_id = $1', [MEMBER_ID]);
    await pool.query(
      'UPDATE users SET totp_secret = NULL, totp_activated_at = NULL, totp_last_step = NULL WHERE id = $1',
      [MEMBER_ID],
    );
    await clearTotpCounters();
    // Contador de login limpo também: a suíte erra a senha de propósito em um dos casos.
    let cursor = '0';
    do {
      const found = await redis.scan(cursor, { MATCH: 'auth:login:*', COUNT: 100 });
      cursor = found.cursor;
      if (found.keys.length > 0) await redis.del(found.keys);
    } while (cursor !== '0');

    const started = await authed('post', '/api/v1/auth/second-factor').expect(201);
    secret = started.body.secret;
    const activated = await authed('post', '/api/v1/auth/second-factor/activate')
      .send({ code: codeFor(secret) })
      .expect(200);
    recoveryCodes = activated.body.recoveryCodes;
    // A ativação gasta o passo corrente, e é para gastar mesmo: o código usado para ativar
    // não pode servir de entrada logo em seguida. Aqui o passo guardado volta a nulo para
    // simular o tempo que separa a inscrição da primeira entrada de verdade.
    await pool.query('UPDATE users SET totp_last_step = NULL WHERE id = $1', [MEMBER_ID]);
    await clearTotpCounters();
  });

  it('refuses the password alone once the factor is active', async () => {
    const withoutCode = await signIn({}).expect(401);

    assert.equal(withoutCode.body.code, 'SECOND_FACTOR_REQUIRED');
    // Nenhum token sai daqui: a senha sozinha deixou de bastar.
    assert.equal(withoutCode.body.accessToken, undefined);
    assert.equal(withoutCode.headers['set-cookie'], undefined);
  });

  it('refuses the very code that activated the factor', async () => {
    // Descoberto pela CI: a ativação consome o passo, então o mesmo código não entra em
    // seguida. É o comportamento correto — um código vale uma vez, inclusive esse.
    await pool.query('UPDATE users SET totp_last_step = $2 WHERE id = $1', [
      MEMBER_ID,
      Math.floor(Date.now() / 1000 / 30),
    ]);

    const refused = await signIn({ secondFactorCode: codeFor(secret) }).expect(401);
    assert.equal(refused.body.code, 'SECOND_FACTOR_CODE_INVALID');
  });

  it('completes the sign-in with the code from the app', async () => {
    const signedIn = await signIn({ secondFactorCode: codeFor(secret) }).expect(200);

    assert.equal(typeof signedIn.body.accessToken, 'string');
  });

  it('never reveals the second factor to someone who got the password wrong', async () => {
    // A resposta precisa ser a mesma de sempre: dizer "informe o código" a quem errou a senha
    // confirmaria a conta e entregaria que ela já tem segundo fator ativo.
    const wrongPassword = await signIn({ password: 'senha-errada-14' }).expect(401);

    assert.equal(wrongPassword.body.code, 'INVALID_CREDENTIALS');
  });

  it('spends the code within its step, so interception does not buy a second entry', async () => {
    const code = codeFor(secret);
    await signIn({ secondFactorCode: code }).expect(200);

    const replay = await signIn({ secondFactorCode: code }).expect(401);
    assert.equal(replay.body.code, 'SECOND_FACTOR_CODE_INVALID');
  });

  it('accepts a recovery code, and only once', async () => {
    const code = recoveryCodes[0];

    await signIn({ secondFactorCode: code }).expect(200);
    const replay = await signIn({ secondFactorCode: code }).expect(401);
    assert.equal(replay.body.code, 'SECOND_FACTOR_CODE_INVALID');

    const remaining = await pool.query(
      'SELECT count(*)::int AS count FROM totp_recovery_codes WHERE user_id = $1 AND used_at IS NULL',
      [MEMBER_ID],
    );
    assert.equal(remaining.rows[0].count, 9);
  });

  it('audits the use of a recovery code, because it is worth noticing', async () => {
    await signIn({ secondFactorCode: recoveryCodes[1] }).expect(200);

    const audits = await pool.query(
      `SELECT action FROM audit_logs
       WHERE user_id = $1 AND action = 'auth.second_factor.recovery_used'`,
      [MEMBER_ID],
    );
    assert.equal(audits.rows.length, 1);
  });

  it('counts wrong codes at sign-in and blocks brute force', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await signIn({ secondFactorCode: '000000' }).expect(401);
    }
    const blocked = await signIn({ secondFactorCode: '000000' }).expect(429);

    assert.equal(blocked.body.code, 'AUTH_RATE_LIMITED');
  });
});
