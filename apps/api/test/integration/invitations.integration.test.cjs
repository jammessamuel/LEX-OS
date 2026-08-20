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
process.env.PROCESSING_QUEUE_PREFIX = 'lex-os-invitations-integration';

const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION_SLUG = 'lex-os-demonstracao';
const ADMIN_USER_ID = '00000000-0000-4000-8000-000000000002';
const ADMIN_EMAIL = 'admin@lexos.invalid';
const INTERN_ROLE_ID = '00000000-0000-4000-8000-000000000105';

// Escritorio vizinho, para provar que convite nao atravessa fronteira de tenant.
const OTHER_ORGANIZATION_ID = '12000000-0000-4000-8000-000000000001';
const OTHER_ORGANIZATION_SLUG = 'outra-convites';
const OTHER_ADMIN_ID = '12000000-0000-4000-8000-000000000002';
const OTHER_ADMIN_EMAIL = 'd12-outro-admin@lexos.invalid';
const ADMIN_ROLE_ID = '00000000-0000-4000-8000-000000000101';

const INVITEE_EMAIL = 'd12-convidada@lexos.invalid';
const INVITEE_PASSWORD = 'senha-ficticia-do-convite';

const databaseUrl = process.env.DATABASE_URL;
const seedPassword = process.env.SEED_ADMIN_PASSWORD;
if (databaseUrl === undefined || seedPassword === undefined) {
  throw new Error('DATABASE_URL and SEED_ADMIN_PASSWORD are required for API integration tests.');
}

const pool = new Pool({ connectionString: databaseUrl });
let app;
let http;
let adminToken;
let otherAdminToken;

async function cleanup() {
  await pool.query(
    `DELETE FROM user_invitations
     WHERE organization_id IN ($1, $2)`,
    [ORGANIZATION_ID, OTHER_ORGANIZATION_ID],
  );
  await pool.query(
    `DELETE FROM audit_logs
     WHERE organization_id IN ($1, $2) AND action LIKE 'user.%'`,
    [ORGANIZATION_ID, OTHER_ORGANIZATION_ID],
  );
  await pool.query(
    `DELETE FROM user_roles
     WHERE user_id IN (SELECT id FROM users WHERE email = $1 OR organization_id = $2)`,
    [INVITEE_EMAIL, OTHER_ORGANIZATION_ID],
  );
  await pool.query('DELETE FROM refresh_sessions WHERE organization_id = $1', [
    OTHER_ORGANIZATION_ID,
  ]);
  await pool.query('DELETE FROM users WHERE email = $1 OR organization_id = $2', [
    INVITEE_EMAIL,
    OTHER_ORGANIZATION_ID,
  ]);
  await pool.query('DELETE FROM organizations WHERE id = $1', [OTHER_ORGANIZATION_ID]);
}

async function setupFixtures() {
  await pool.query(
    `INSERT INTO organizations
      (id, slug, legal_name, trade_name, document_number, subscription_plan, updated_at)
     VALUES ($1, $2, 'Organização Convites Fictícia', 'Convites Fictício', 'D12-OTHER', 'TEST', now())`,
    [OTHER_ORGANIZATION_ID, OTHER_ORGANIZATION_SLUG],
  );
  await pool.query(
    `INSERT INTO users
      (id, organization_id, name, email, password_hash, status, updated_at)
     SELECT $1, $2, 'Administrador Vizinho Fictício', $3, password_hash, 'ACTIVE', now()
     FROM users WHERE id = $4`,
    [OTHER_ADMIN_ID, OTHER_ORGANIZATION_ID, OTHER_ADMIN_EMAIL, ADMIN_USER_ID],
  );
  await pool.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [
    OTHER_ADMIN_ID,
    ADMIN_ROLE_ID,
  ]);
}

function login(organizationSlug, email, password = seedPassword) {
  return request(http).post('/api/v1/auth/login').send({ organizationSlug, email, password });
}

function invite(token, body) {
  return request(http)
    .post('/api/v1/users/invitations')
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

async function removeInvitee() {
  await pool.query(
    'DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM users WHERE email = $1)',
    [INVITEE_EMAIL],
  );
  await pool.query(
    `DELETE FROM user_invitations
     WHERE user_id IN (SELECT id FROM users WHERE email = $1)`,
    [INVITEE_EMAIL],
  );
  await pool.query(
    'DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE email = $1)',
    [INVITEE_EMAIL],
  );
  await pool.query(
    `DELETE FROM refresh_sessions
     WHERE user_id IN (SELECT id FROM users WHERE email = $1)`,
    [INVITEE_EMAIL],
  );
  await pool.query('DELETE FROM users WHERE email = $1', [INVITEE_EMAIL]);
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
  adminToken = (await login(ORGANIZATION_SLUG, ADMIN_EMAIL)).body.accessToken;
  otherAdminToken = (await login(OTHER_ORGANIZATION_SLUG, OTHER_ADMIN_EMAIL)).body.accessToken;
  assert.ok(adminToken, 'the seeded administrator must authenticate');
  assert.ok(otherAdminToken, 'the neighbouring administrator must authenticate');
});

after(async () => {
  await app?.close();
  await cleanup();
  await pool.end();
});

describe('Delivery 12 invitation lifecycle', () => {
  beforeEach(async () => {
    await removeInvitee();
  });

  it('completes invite, accept, and sign-in with the firm slug', async () => {
    const invited = await invite(adminToken, {
      name: 'Convidada Fictícia',
      email: INVITEE_EMAIL,
      roleIds: [INTERN_ROLE_ID],
    }).expect(201);

    assert.equal(invited.body.user.status, 'INVITED');
    assert.equal(typeof invited.body.token, 'string');
    assert.ok(invited.body.token.length >= 40);

    // Antes do aceite nao ha senha utilizavel, entao nao ha entrada.
    const early = await login(ORGANIZATION_SLUG, INVITEE_EMAIL, INVITEE_PASSWORD);
    assert.equal(early.status, 401);

    await request(http)
      .post('/api/v1/auth/invitations/accept')
      .send({ token: invited.body.token, password: INVITEE_PASSWORD })
      .expect(204);

    const signedIn = await login(ORGANIZATION_SLUG, INVITEE_EMAIL, INVITEE_PASSWORD).expect(200);
    assert.equal(typeof signedIn.body.accessToken, 'string');
    assert.equal(signedIn.body.user.email, INVITEE_EMAIL);
  });

  it('refuses a token that was already used, so the link is spent on first accept', async () => {
    const invited = await invite(adminToken, {
      name: 'Convidada Fictícia',
      email: INVITEE_EMAIL,
      roleIds: [],
    }).expect(201);

    await request(http)
      .post('/api/v1/auth/invitations/accept')
      .send({ token: invited.body.token, password: INVITEE_PASSWORD })
      .expect(204);

    const replay = await request(http)
      .post('/api/v1/auth/invitations/accept')
      .send({ token: invited.body.token, password: 'outra-senha-ficticia-12' })
      .expect(401);

    assert.equal(replay.body.code, 'INVITATION_INVALID');
  });

  it('refuses an expired token and says nothing different from an unknown one', async () => {
    const invited = await invite(adminToken, {
      name: 'Convidada Fictícia',
      email: INVITEE_EMAIL,
      roleIds: [],
    }).expect(201);
    await pool.query("UPDATE user_invitations SET expires_at = now() - interval '1 day'");

    const expired = await request(http)
      .post('/api/v1/auth/invitations/accept')
      .send({ token: invited.body.token, password: INVITEE_PASSWORD })
      .expect(401);
    const unknown = await request(http)
      .post('/api/v1/auth/invitations/accept')
      .send({ token: 'a'.repeat(43), password: INVITEE_PASSWORD })
      .expect(401);

    assert.equal(expired.body.code, unknown.body.code);
    assert.equal(expired.body.message, unknown.body.message);
  });

  it('refuses a revoked token', async () => {
    const invited = await invite(adminToken, {
      name: 'Convidada Fictícia',
      email: INVITEE_EMAIL,
      roleIds: [],
    }).expect(201);

    await request(http)
      .delete(`/api/v1/users/invitations/${invited.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    await request(http)
      .post('/api/v1/auth/invitations/accept')
      .send({ token: invited.body.token, password: INVITEE_PASSWORD })
      .expect(401);
  });

  it('keeps invitations inside their tenant on listing and revocation', async () => {
    const invited = await invite(adminToken, {
      name: 'Convidada Fictícia',
      email: INVITEE_EMAIL,
      roleIds: [],
    }).expect(201);

    // O vizinho conhece o identificador e ainda assim recebe 404: a resposta nao pode
    // revelar que o convite existe em outro lugar.
    await request(http)
      .delete(`/api/v1/users/invitations/${invited.body.id}`)
      .set('Authorization', `Bearer ${otherAdminToken}`)
      .expect(404);

    const neighbourList = await request(http)
      .get('/api/v1/users/invitations')
      .set('Authorization', `Bearer ${otherAdminToken}`)
      .expect(200);
    assert.equal(
      neighbourList.body.data.some((row) => row.id === invited.body.id),
      false,
    );

    const ownList = await request(http)
      .get('/api/v1/users/invitations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    assert.ok(ownList.body.data.some((row) => row.id === invited.body.id));
  });

  it('lets an administrator grant a weaker role, because that is the ordinary case', async () => {
    // A regra e sobre permissao, nao sobre papel. Exigir o mesmo papel impediria justamente
    // o que um administrador faz todo dia: criar um estagiario.
    const invited = await invite(adminToken, {
      name: 'Estagiária Convidada Fictícia',
      email: INVITEE_EMAIL,
      roleIds: [INTERN_ROLE_ID],
    }).expect(201);

    const roles = await pool.query('SELECT role_id FROM user_roles WHERE user_id = $1', [
      invited.body.user.id,
    ]);
    assert.deepEqual(
      roles.rows.map((row) => row.role_id),
      [INTERN_ROLE_ID],
    );
  });

  it('refuses a role carrying a permission the inviter lacks', async () => {
    // Quem gerencia pessoas mas nao administra tudo nao pode cunhar um administrador.
    const managerId = '12000000-0000-4000-8000-000000000011';
    const managerEmail = 'd12-gestora@lexos.invalid';
    const managerRole = await pool.query(
      `INSERT INTO roles (organization_id, name, code, updated_at)
       VALUES ($1, 'Gestora de Pessoas Fictícia', 'D12_PESSOAS', now())
       RETURNING id`,
      [ORGANIZATION_ID],
    );
    const managerRoleId = managerRole.rows[0].id;
    await pool.query(
      `INSERT INTO role_permissions (role_id, permission_id)
       SELECT $1, id FROM permissions WHERE code IN ('users.manage', 'organizations.read')`,
      [managerRoleId],
    );
    await pool.query(
      `INSERT INTO users
        (id, organization_id, name, email, password_hash, status, updated_at)
       SELECT $1, $2, 'Gestora Fictícia D12', $3, password_hash, 'ACTIVE', now()
       FROM users WHERE id = $4`,
      [managerId, ORGANIZATION_ID, managerEmail, ADMIN_USER_ID],
    );
    await pool.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [
      managerId,
      managerRoleId,
    ]);

    try {
      const managerToken = (await login(ORGANIZATION_SLUG, managerEmail).expect(200)).body
        .accessToken;

      const rejected = await invite(managerToken, {
        name: 'Convidada Fictícia',
        email: INVITEE_EMAIL,
        roleIds: [ADMIN_ROLE_ID],
      }).expect(403);
      assert.equal(rejected.body.code, 'ROLE_NOT_GRANTABLE');

      const created = await pool.query(
        'SELECT count(*)::int AS count FROM users WHERE email = $1',
        [INVITEE_EMAIL],
      );
      assert.equal(created.rows[0].count, 0, 'a refused invitation must not leave a user behind');
    } finally {
      await pool.query('DELETE FROM refresh_sessions WHERE user_id = $1', [managerId]);
      await pool.query('DELETE FROM user_roles WHERE user_id = $1', [managerId]);
      await pool.query('DELETE FROM audit_logs WHERE user_id = $1', [managerId]);
      await pool.query('DELETE FROM users WHERE id = $1', [managerId]);
      await pool.query('DELETE FROM role_permissions WHERE role_id = $1', [managerRoleId]);
      await pool.query('DELETE FROM roles WHERE id = $1', [managerRoleId]);
    }
  });

  it('refuses a role that belongs to another firm', async () => {
    const foreignRole = await pool.query(
      `INSERT INTO roles (organization_id, name, code, updated_at)
       VALUES ($1, 'Papel Vizinho Fictício', 'D12_OUTRO', now())
       RETURNING id`,
      [OTHER_ORGANIZATION_ID],
    );

    try {
      const rejected = await invite(adminToken, {
        name: 'Convidada Fictícia',
        email: INVITEE_EMAIL,
        roleIds: [foreignRole.rows[0].id],
      }).expect(403);
      assert.equal(rejected.body.code, 'ROLE_NOT_GRANTABLE');
    } finally {
      await pool.query('DELETE FROM roles WHERE id = $1', [foreignRole.rows[0].id]);
    }
  });

  it('refuses a duplicate e-mail inside the same firm', async () => {
    await invite(adminToken, {
      name: 'Convidada Fictícia',
      email: INVITEE_EMAIL,
      roleIds: [],
    }).expect(201);

    const duplicate = await invite(adminToken, {
      name: 'Outra Convidada Fictícia',
      email: INVITEE_EMAIL,
      roleIds: [],
    }).expect(409);
    assert.equal(duplicate.body.code, 'USER_ALREADY_EXISTS');
  });

  it('never stores the token in clear text nor writes it to the audit trail', async () => {
    const invited = await invite(adminToken, {
      name: 'Convidada Fictícia',
      email: INVITEE_EMAIL,
      roleIds: [INTERN_ROLE_ID],
    }).expect(201);

    const stored = await pool.query('SELECT token_hash FROM user_invitations WHERE id = $1', [
      invited.body.id,
    ]);
    assert.equal(stored.rows.length, 1);
    assert.notEqual(stored.rows[0].token_hash, invited.body.token);
    assert.match(stored.rows[0].token_hash, /^[0-9a-f]{64}$/u);

    const audits = await pool.query(
      `SELECT action, new_data FROM audit_logs
       WHERE organization_id = $1 AND action = 'user.invited'`,
      [ORGANIZATION_ID],
    );
    assert.equal(audits.rows.length, 1);
    const serialized = JSON.stringify(audits.rows);
    assert.equal(serialized.includes(invited.body.token), false);
    assert.equal(serialized.includes(INVITEE_EMAIL), false, 'audit must not carry the e-mail');
    assert.deepEqual(audits.rows[0].new_data, { roleCount: 1 });
  });

  it('gates on the users.manage permission, not on a role name', async () => {
    // Estagiario tem leitura de varios recursos e nenhuma gestao de pessoas. E o caso que
    // distingue permissao de papel: negar aqui nao pode depender do nome do papel.
    const internId = '12000000-0000-4000-8000-000000000009';
    const internEmail = 'd12-estagiaria@lexos.invalid';
    await pool.query(
      `INSERT INTO users
        (id, organization_id, name, email, password_hash, status, updated_at)
       SELECT $1, $2, 'Estagiária Fictícia D12', $3, password_hash, 'ACTIVE', now()
       FROM users WHERE id = $4`,
      [internId, ORGANIZATION_ID, internEmail, ADMIN_USER_ID],
    );
    await pool.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [
      internId,
      INTERN_ROLE_ID,
    ]);

    try {
      const internToken = (await login(ORGANIZATION_SLUG, internEmail).expect(200)).body
        .accessToken;

      await request(http)
        .post('/api/v1/users/invitations')
        .set('Authorization', `Bearer ${internToken}`)
        .send({ name: 'Convidada Fictícia', email: INVITEE_EMAIL, roleIds: [] })
        .expect(403);
      await request(http)
        .get('/api/v1/users/invitations')
        .set('Authorization', `Bearer ${internToken}`)
        .expect(403);
    } finally {
      await pool.query('DELETE FROM refresh_sessions WHERE user_id = $1', [internId]);
      await pool.query('DELETE FROM user_roles WHERE user_id = $1', [internId]);
      await pool.query('DELETE FROM users WHERE id = $1', [internId]);
    }
  });

  it('leaves no user behind when the invitation is refused for a duplicate e-mail', async () => {
    await invite(adminToken, {
      name: 'Convidada Fictícia',
      email: INVITEE_EMAIL,
      roleIds: [],
    }).expect(201);

    const before = await pool.query('SELECT count(*)::int AS count FROM users WHERE email = $1', [
      INVITEE_EMAIL,
    ]);
    await invite(adminToken, { name: 'Outra', email: INVITEE_EMAIL, roleIds: [] }).expect(409);
    const after = await pool.query('SELECT count(*)::int AS count FROM users WHERE email = $1', [
      INVITEE_EMAIL,
    ]);

    assert.equal(after.rows[0].count, before.rows[0].count);
  });
});
