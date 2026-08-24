const assert = require('node:assert/strict');
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
process.env.PROCESSING_QUEUE_PREFIX = 'lex-os-resources-integration';

const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
const ADMIN_USER_ID = '00000000-0000-4000-8000-000000000002';
const READ_ONLY_ROLE_ID = '00000000-0000-4000-8000-000000000106';
const READ_ONLY_USER_ID = '30000000-0000-4000-8000-000000000001';
const READ_ONLY_EMAIL = 'd5-read-only@lexos.invalid';
const NO_PERMISSION_USER_ID = '30000000-0000-4000-8000-000000000006';
const NO_PERMISSION_EMAIL = 'd5-no-permission@lexos.invalid';
const BLOCKED_USER_ID = '30000000-0000-4000-8000-000000000007';
const OTHER_ORGANIZATION_ID = '30000000-0000-4000-8000-000000000002';
const OTHER_USER_ID = '30000000-0000-4000-8000-000000000003';
const OTHER_PERSON_ID = '30000000-0000-4000-8000-000000000004';
const OTHER_CASE_ID = '30000000-0000-4000-8000-000000000005';
const ADMIN_EMAIL = 'admin@lexos.invalid';
const TEST_CPF = '11144477735';
const TEST_CNPJ = '11222333000181';

const databaseUrl = process.env.DATABASE_URL;
const seedPassword = process.env.SEED_ADMIN_PASSWORD;

if (databaseUrl === undefined || seedPassword === undefined) {
  throw new Error('DATABASE_URL and SEED_ADMIN_PASSWORD are required for API integration tests.');
}

const pool = new Pool({ connectionString: databaseUrl });
let app;
let http;
let adminToken;
let readOnlyToken;
let noPermissionToken;
let individualId;
let companyId;
let standardCaseId;
let confidentialCaseId;

async function cleanup() {
  await pool.query(
    `DELETE FROM audit_logs
     WHERE organization_id = $1
       AND (action LIKE 'auth.%' OR action LIKE 'person.%' OR action LIKE 'case.%' OR action LIKE 'case_participant.%' OR action LIKE 'user.%')`,
    [ORGANIZATION_ID],
  );
  await pool.query('DELETE FROM audit_logs WHERE organization_id = $1', [OTHER_ORGANIZATION_ID]);
  await pool.query(
    `DELETE FROM case_participants
     WHERE organization_id IN ($1, $2)
       AND (case_id = $3 OR case_id IN (SELECT id FROM cases WHERE internal_code LIKE 'D5-%'))`,
    [ORGANIZATION_ID, OTHER_ORGANIZATION_ID, OTHER_CASE_ID],
  );
  await pool.query("DELETE FROM cases WHERE internal_code LIKE 'D5-%' OR id = $1", [OTHER_CASE_ID]);
  await pool.query(
    "DELETE FROM persons WHERE full_name LIKE 'Pessoa Fictícia D5%' OR full_name LIKE 'Empresa Fictícia D5%' OR id = $1",
    [OTHER_PERSON_ID],
  );
  await pool.query('DELETE FROM refresh_sessions WHERE user_id IN ($1, $2, $3, $4)', [
    ADMIN_USER_ID,
    READ_ONLY_USER_ID,
    OTHER_USER_ID,
    NO_PERMISSION_USER_ID,
  ]);
  await pool.query('DELETE FROM user_roles WHERE user_id IN ($1, $2)', [
    READ_ONLY_USER_ID,
    OTHER_USER_ID,
  ]);
  await pool.query('DELETE FROM users WHERE id IN ($1, $2, $3, $4)', [
    READ_ONLY_USER_ID,
    OTHER_USER_ID,
    NO_PERMISSION_USER_ID,
    BLOCKED_USER_ID,
  ]);
  await pool.query('DELETE FROM organizations WHERE id = $1', [OTHER_ORGANIZATION_ID]);
}

async function setupIsolationFixtures() {
  await pool.query(
    `INSERT INTO organizations
      (id, slug, legal_name, trade_name, document_number, subscription_plan, status, settings, updated_at)
     VALUES ($1, 'outra-recursos', 'Organização Externa Fictícia Ltda.', 'Tenant Externo Fictício', '00000000000000', 'TEST', 'ACTIVE', '{"fixture":true}', now())`,
    [OTHER_ORGANIZATION_ID],
  );
  await pool.query(
    `INSERT INTO users
      (id, organization_id, name, email, password_hash, status, updated_at)
     SELECT $1, $2, 'Leitor Fictício D5', $3, password_hash, 'ACTIVE', now()
     FROM users WHERE id = $4`,
    [READ_ONLY_USER_ID, ORGANIZATION_ID, READ_ONLY_EMAIL, ADMIN_USER_ID],
  );
  await pool.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [
    READ_ONLY_USER_ID,
    READ_ONLY_ROLE_ID,
  ]);
  await pool.query(
    `INSERT INTO users
      (id, organization_id, name, email, password_hash, status, updated_at)
     SELECT $1, $2, 'Usuário sem Permissões Fictício', $3, password_hash, 'ACTIVE', now()
     FROM users WHERE id = $4`,
    [NO_PERMISSION_USER_ID, ORGANIZATION_ID, NO_PERMISSION_EMAIL, ADMIN_USER_ID],
  );
  await pool.query(
    `INSERT INTO users
      (id, organization_id, name, email, password_hash, status, updated_at)
     SELECT $1, $2, 'Usuário Bloqueado Fictício', 'd5-blocked@lexos.invalid', password_hash,
       'BLOCKED', now()
     FROM users WHERE id = $3`,
    [BLOCKED_USER_ID, ORGANIZATION_ID, ADMIN_USER_ID],
  );
  await pool.query(
    `INSERT INTO users
      (id, organization_id, name, email, password_hash, status, updated_at)
     SELECT $1, $2, 'Usuário de Outro Tenant Fictício', 'd5-other@lexos.invalid', password_hash, 'ACTIVE', now()
     FROM users WHERE id = $3`,
    [OTHER_USER_ID, OTHER_ORGANIZATION_ID, ADMIN_USER_ID],
  );
  await pool.query(
    `INSERT INTO persons
      (id, organization_id, person_type, full_name, metadata, updated_at)
     VALUES ($1, $2, 'INDIVIDUAL', 'Pessoa Fictícia D5 Outro Tenant', '{}', now())`,
    [OTHER_PERSON_ID, OTHER_ORGANIZATION_ID],
  );
  await pool.query(
    `INSERT INTO cases
      (id, organization_id, internal_code, cnj_number, title, legal_area, case_type, status,
       priority, confidentiality_level, responsible_user_id, updated_at)
     VALUES ($1, $2, 'D5-OTHER-001', '0007777-22.2026.8.26.0100',
       'Caso Fictício de Outro Tenant', 'TESTE', 'TESTE',
       'INTAKE', 'NORMAL', 'STANDARD', $3, now())`,
    [OTHER_CASE_ID, OTHER_ORGANIZATION_ID, OTHER_USER_ID],
  );
}

async function login(email) {
  const response = await request(http)
    .post('/api/v1/auth/login')
    .send({ organizationSlug: 'lex-os-demonstracao', email, password: seedPassword })
    .expect(200);
  return response.body.accessToken;
}

function authorized(method, url, token = adminToken) {
  return request(http)[method](url).set('authorization', `Bearer ${token}`);
}

before(async () => {
  await cleanup();
  await setupIsolationFixtures();
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
  readOnlyToken = await login(READ_ONLY_EMAIL);
  noPermissionToken = await login(NO_PERMISSION_EMAIL);
});

after(async () => {
  await app?.close();
  await cleanup();
  await pool.end();
});

describe('Delivery 5 people, cases, and participants', () => {
  it('publishes only the implemented Delivery 5 resource routes', async () => {
    const response = await request(http).get('/api/v1/docs/openapi.json').expect(200);

    assert.ok(response.body.paths['/api/v1/persons']);
    assert.ok(response.body.paths['/api/v1/persons/{id}']);
    assert.ok(response.body.paths['/api/v1/persons/{id}/cases']?.get);
    assert.ok(response.body.paths['/api/v1/cases']);
    assert.ok(response.body.paths['/api/v1/cases/{id}']);
    assert.ok(response.body.paths['/api/v1/cases/{id}/processing-budget']?.patch);
    assert.ok(response.body.paths['/api/v1/cases/{caseId}/participants']);
    assert.ok(response.body.paths['/api/v1/cases/{caseId}/files/upload']);
    assert.ok(response.body.paths['/api/v1/documents/{id}/reprocess']?.post);
    assert.ok(response.body.paths['/api/v1/processing-jobs/{id}']?.get);
    assert.ok(response.body.paths['/api/v1/users/assignable']?.get);
    assert.equal(
      response.body.components.schemas.CaseResponseDto.properties.responsible.nullable,
      true,
    );
  });

  it('rejects invalid identifiers, participant vocabulary, unknown tenant fields, and cursors', async () => {
    const invalidPerson = await authorized('post', '/api/v1/persons')
      .send({
        organizationId: OTHER_ORGANIZATION_ID,
        personType: 'INDIVIDUAL',
        fullName: 'Pessoa Fictícia D5 Inválida',
        cpf: '000.000.000-00',
      })
      .expect(400);
    assert.equal(invalidPerson.body.code, 'VALIDATION_ERROR');

    const invalidCursor = await authorized('get', '/api/v1/persons?cursor=not+base64').expect(400);
    assert.equal(invalidCursor.body.code, 'INVALID_CURSOR');

    await authorized('post', `/api/v1/cases/${OTHER_CASE_ID}/participants`)
      .send({ personId: OTHER_PERSON_ID, role: 'papel_inventado', side: 'lado_inventado' })
      .expect(400);
  });

  it('creates, lists, reads, and updates people while masking normalized identifiers', async () => {
    const individual = await authorized('post', '/api/v1/persons')
      .send({
        personType: 'INDIVIDUAL',
        fullName: 'Pessoa Fictícia D5 Individual',
        cpf: '111.444.777-35',
        rg: 'FICTICIO1234',
        birthDate: '1990-01-01',
        email: 'PESSOA.D5@LEXOS.INVALID',
      })
      .expect(201);
    individualId = individual.body.id;
    assert.equal(individual.body.cpf, '***.***.***-35');
    assert.equal(individual.body.rg, '****1234');
    assert.equal(individual.body.email, 'pessoa.d5@lexos.invalid');
    assert.equal(JSON.stringify(individual.body).includes(TEST_CPF), false);

    const company = await authorized('post', '/api/v1/persons')
      .send({
        personType: 'COMPANY',
        fullName: 'Empresa Fictícia D5 Ltda.',
        tradeName: 'Empresa Fictícia D5',
        cnpj: '11.222.333/0001-81',
      })
      .expect(201);
    companyId = company.body.id;
    assert.equal(company.body.cnpj, '**.***.***/****-81');

    const stored = await pool.query('SELECT cpf, cnpj FROM persons WHERE id IN ($1, $2)', [
      individualId,
      companyId,
    ]);
    assert.equal(
      stored.rows.some((row) => row.cpf === TEST_CPF),
      true,
    );
    assert.equal(
      stored.rows.some((row) => row.cnpj === TEST_CNPJ),
      true,
    );

    const pageOne = await authorized('get', '/api/v1/persons?limit=1').expect(200);
    assert.equal(pageOne.body.data.length, 1);
    assert.equal(pageOne.body.pageInfo.hasNextPage, true);
    const pageTwo = await authorized(
      'get',
      `/api/v1/persons?limit=1&cursor=${encodeURIComponent(pageOne.body.pageInfo.nextCursor)}`,
    ).expect(200);
    assert.notEqual(pageTwo.body.data[0].id, pageOne.body.data[0].id);

    const updated = await authorized('patch', `/api/v1/persons/${individualId}`)
      .send({ occupation: 'Profissão Fictícia' })
      .expect(200);
    assert.equal(updated.body.occupation, 'Profissão Fictícia');
    await authorized('get', `/api/v1/persons/${individualId}`).expect(200);
  });

  it('lists only minimal active tenant users for assignment and audits the read', async () => {
    const response = await authorized('get', '/api/v1/users/assignable?limit=100').expect(200);
    const ids = response.body.data.map((user) => user.id);
    assert.equal(ids.includes(ADMIN_USER_ID), true);
    assert.equal(ids.includes(READ_ONLY_USER_ID), true);
    assert.equal(ids.includes(NO_PERMISSION_USER_ID), true);
    assert.equal(ids.includes(BLOCKED_USER_ID), false);
    assert.equal(ids.includes(OTHER_USER_ID), false);
    assert.equal(
      response.body.data.every(
        (user) => JSON.stringify(Object.keys(user).sort()) === JSON.stringify(['id', 'name']),
      ),
      true,
    );

    await authorized('get', '/api/v1/users/assignable', noPermissionToken).expect(403);
    const invalidCursor = await authorized(
      'get',
      '/api/v1/users/assignable?cursor=not+base64',
    ).expect(400);
    assert.equal(invalidCursor.body.code, 'INVALID_CURSOR');

    const audits = await pool.query(
      `SELECT count(*)::int AS count, coalesce(string_agg(new_data::text, ''), '') AS data
       FROM audit_logs
       WHERE organization_id = $1 AND action = 'user.assignable.listed'`,
      [ORGANIZATION_ID],
    );
    assert.ok(audits.rows[0].count > 0);
    assert.equal(audits.rows[0].data.includes('Administrador Fictício'), false);
  });

  it('fails person list, direct lookup, update, and soft-deleted reads safely across tenant boundaries', async () => {
    const list = await authorized('get', '/api/v1/persons').expect(200);
    assert.equal(
      list.body.data.some((person) => person.id === OTHER_PERSON_ID),
      false,
    );
    await authorized('get', `/api/v1/persons/${OTHER_PERSON_ID}`).expect(404);
    await authorized('patch', `/api/v1/persons/${OTHER_PERSON_ID}`)
      .send({ occupation: 'Tentativa inválida' })
      .expect(404);
    await authorized('delete', `/api/v1/persons/${OTHER_PERSON_ID}`).expect(404);

    await authorized('delete', `/api/v1/persons/${companyId}`).expect(204);
    await authorized('get', `/api/v1/persons/${companyId}`).expect(404);
    const afterDelete = await authorized('get', '/api/v1/persons').expect(200);
    assert.equal(
      afterDelete.body.data.some((person) => person.id === companyId),
      false,
    );
  });

  it('creates and updates tenant-scoped cases with unique code and valid responsibility', async () => {
    const created = await authorized('post', '/api/v1/cases')
      .send({
        internalCode: 'd5-standard-001',
        title: 'Caso Fictício D5 Padrão',
        description: 'Descrição jurídica inteiramente fictícia.',
        legalArea: 'direito_trabalhista',
        caseType: 'reclamacao_trabalhista',
        responsibleUserId: ADMIN_USER_ID,
      })
      .expect(201);
    standardCaseId = created.body.id;
    assert.equal(created.body.internalCode, 'D5-STANDARD-001');
    assert.equal(created.body.legalArea, 'DIREITO_TRABALHISTA');
    assert.deepEqual(created.body.responsible, {
      id: ADMIN_USER_ID,
      name: 'Administrador Fictício',
    });
    assert.equal('email' in created.body.responsible, false);
    assert.equal('status' in created.body.responsible, false);
    assert.equal(created.body.processingCostLimitAmount, '0.000000');
    assert.equal(created.body.processingCostSpentAmount, '0.000000');
    assert.equal(created.body.processingCostReservedAmount, '0.000000');
    assert.equal(created.body.processingCostCurrency, 'BRL');
    assert.equal(created.body.processingBudgetStatus, 'ACTIVE');

    await authorized('patch', `/api/v1/cases/${standardCaseId}/processing-budget`)
      .send({ limitAmount: '-1' })
      .expect(400);
    const budget = await authorized('patch', `/api/v1/cases/${standardCaseId}/processing-budget`)
      .send({ limitAmount: '25.5' })
      .expect(200);
    assert.equal(budget.body.processingCostLimitAmount, '25.500000');
    assert.equal(budget.body.processingBudgetStatus, 'ACTIVE');

    const duplicate = await authorized('post', '/api/v1/cases')
      .send({
        internalCode: 'D5-STANDARD-001',
        title: 'Outro Caso Fictício D5',
        legalArea: 'TESTE',
        caseType: 'TESTE',
      })
      .expect(409);
    assert.equal(duplicate.body.code, 'CASE_INTERNAL_CODE_CONFLICT');

    const invalidResponsible = await authorized('post', '/api/v1/cases')
      .send({
        internalCode: 'D5-INVALID-RESPONSIBLE',
        title: 'Caso Fictício com Responsável Inválido',
        legalArea: 'TESTE',
        caseType: 'TESTE',
        responsibleUserId: OTHER_USER_ID,
      })
      .expect(400);
    assert.equal(invalidResponsible.body.code, 'INVALID_CASE_RESPONSIBLE');

    const updated = await authorized('patch', `/api/v1/cases/${standardCaseId}`)
      .send({ status: 'UNDER_ANALYSIS', priority: 'HIGH' })
      .expect(200);
    assert.equal(updated.body.status, 'UNDER_ANALYSIS');
    assert.equal(updated.body.priority, 'HIGH');

    const listed = await authorized('get', '/api/v1/cases').expect(200);
    const listedCase = listed.body.data.find((item) => item.id === standardCaseId);
    assert.deepEqual(listedCase.responsible, {
      id: ADMIN_USER_ID,
      name: 'Administrador Fictício',
    });

    const detail = await authorized('get', `/api/v1/cases/${standardCaseId}`).expect(200);
    assert.deepEqual(detail.body.responsible, {
      id: ADMIN_USER_ID,
      name: 'Administrador Fictício',
    });
  });

  it('hides cross-tenant and soft-deleted cases from list, detail, and update paths', async () => {
    const list = await authorized('get', '/api/v1/cases').expect(200);
    assert.equal(
      list.body.data.some((item) => item.id === OTHER_CASE_ID),
      false,
    );
    await authorized('get', `/api/v1/cases/${OTHER_CASE_ID}`).expect(404);
    await authorized('patch', `/api/v1/cases/${OTHER_CASE_ID}`)
      .send({ priority: 'URGENT' })
      .expect(404);
    await authorized('patch', `/api/v1/cases/${OTHER_CASE_ID}/processing-budget`)
      .send({ limitAmount: '10' })
      .expect(404);
    await authorized('delete', `/api/v1/cases/${OTHER_CASE_ID}`).expect(404);

    const deleted = await authorized('post', '/api/v1/cases')
      .send({
        internalCode: 'D5-DELETED-001',
        title: 'Caso Fictício D5 Excluído',
        legalArea: 'TESTE',
        caseType: 'TESTE',
      })
      .expect(201);
    await authorized('delete', `/api/v1/cases/${deleted.body.id}`).expect(204);
    await authorized('get', `/api/v1/cases/${deleted.body.id}`).expect(404);
    const afterDelete = await authorized('get', '/api/v1/cases').expect(200);
    assert.equal(
      afterDelete.body.data.some((item) => item.id === deleted.body.id),
      false,
    );
  });

  it('accepts the CNJ number only when the check digit holds, and keeps it unique per firm', async () => {
    // Digito verificador trocado: a forma esta certa, o numero nao existe. Uma expressao
    // regular deixaria passar, e o erro so apareceria no dia da consulta ao tribunal.
    const wrongDigit = await authorized('post', '/api/v1/cases')
      .send({
        internalCode: 'D5-CNJ-INVALIDO',
        cnjNumber: '0001234-28.2026.5.02.0001',
        title: 'Caso Fictício com Número Inválido',
        legalArea: 'TESTE',
        caseType: 'TESTE',
      })
      .expect(400);
    assert.equal(wrongDigit.body.code, 'VALIDATION_ERROR');

    const transposed = await authorized('post', '/api/v1/cases')
      .send({
        internalCode: 'D5-CNJ-TRANSPOSTO',
        cnjNumber: '0001243-27.2026.5.02.0001',
        title: 'Caso Fictício com Dígitos Trocados',
        legalArea: 'TESTE',
        caseType: 'TESTE',
      })
      .expect(400);
    assert.equal(transposed.body.code, 'VALIDATION_ERROR');

    // Colado dos autos sem pontuação: entra do mesmo jeito e é guardado na forma do CNJ.
    const created = await authorized('post', '/api/v1/cases')
      .send({
        internalCode: 'D5-CNJ-001',
        cnjNumber: '00099998420265020001',
        court: 'TRT da 2ª Região',
        courtDivision: '1ª Vara do Trabalho de São Paulo',
        title: 'Caso Fictício com Número do Processo',
        legalArea: 'TESTE',
        caseType: 'TESTE',
      })
      .expect(201);
    assert.equal(created.body.cnjNumber, '0009999-84.2026.5.02.0001');
    assert.equal(created.body.cnjSegment, 'Justiça do Trabalho');
    assert.equal(created.body.court, 'TRT da 2ª Região');
    assert.equal(created.body.courtDivision, '1ª Vara do Trabalho de São Paulo');

    // Dois casos com o mesmo processo é erro de cadastro, e o recado tem de apontar o campo
    // certo — dizer "código interno" manda a pessoa corrigir o lugar errado.
    const duplicate = await authorized('post', '/api/v1/cases')
      .send({
        internalCode: 'D5-CNJ-002',
        cnjNumber: '0009999-84.2026.5.02.0001',
        title: 'Outro Caso Fictício com o Mesmo Processo',
        legalArea: 'TESTE',
        caseType: 'TESTE',
      })
      .expect(409);
    assert.equal(duplicate.body.code, 'CASE_CNJ_NUMBER_CONFLICT');

    // Caso sem número é o normal antes do protocolo: o índice parcial não pode reclamar.
    await authorized('post', '/api/v1/cases')
      .send({
        internalCode: 'D5-CNJ-SEM-NUMERO-1',
        title: 'Caso Fictício Ainda Não Protocolado',
        legalArea: 'TESTE',
        caseType: 'TESTE',
      })
      .expect(201);
    await authorized('post', '/api/v1/cases')
      .send({
        internalCode: 'D5-CNJ-SEM-NUMERO-2',
        title: 'Outro Caso Fictício Ainda Não Protocolado',
        legalArea: 'TESTE',
        caseType: 'TESTE',
      })
      .expect(201);

    const cleared = await authorized('patch', `/api/v1/cases/${created.body.id}`)
      .send({ cnjNumber: null, courtDivision: null })
      .expect(200);
    assert.equal(cleared.body.cnjNumber, null);
    assert.equal(cleared.body.cnjSegment, null);
    assert.equal(cleared.body.courtDivision, null);
    assert.equal(cleared.body.court, 'TRT da 2ª Região');

    const restored = await authorized('patch', `/api/v1/cases/${created.body.id}`)
      .send({ cnjNumber: '0009999-84.2026.5.02.0001' })
      .expect(200);
    assert.equal(restored.body.cnjNumber, '0009999-84.2026.5.02.0001');
  });

  it('finds a case by its process number and never crosses the firm boundary', async () => {
    const byNumber = await authorized('get', '/api/v1/cases')
      .query({ search: '0009999-84.2026.5.02.0001' })
      .expect(200);
    assert.equal(byNumber.body.data.length, 1);
    assert.equal(byNumber.body.data[0].internalCode, 'D5-CNJ-001');

    // Sem pontuação encontra o mesmo caso: é assim que o número chega colado do e-mail.
    const unpunctuated = await authorized('get', '/api/v1/cases')
      .query({ search: '00099998420265020001' })
      .expect(200);
    assert.equal(unpunctuated.body.data.length, 1);
    assert.equal(unpunctuated.body.data[0].internalCode, 'D5-CNJ-001');

    const byInternalCode = await authorized('get', '/api/v1/cases')
      .query({ search: 'd5-cnj-001' })
      .expect(200);
    assert.equal(byInternalCode.body.data.length, 1);
    assert.equal(byInternalCode.body.data[0].internalCode, 'D5-CNJ-001');

    const byTitle = await authorized('get', '/api/v1/cases')
      .query({ search: 'Número do Processo' })
      .expect(200);
    assert.equal(byTitle.body.data.length, 1);

    // Isolamento: o número existe, mas pertence a outro escritório.
    const otherTenant = await authorized('get', '/api/v1/cases')
      .query({ search: '0007777-22.2026.8.26.0100' })
      .expect(200);
    assert.equal(otherTenant.body.data.length, 0);

    const otherTenantCode = await authorized('get', '/api/v1/cases')
      .query({ search: 'D5-OTHER-001' })
      .expect(200);
    assert.equal(otherTenantCode.body.data.length, 0);
  });

  it('enforces confidential-case policy and audits authorized confidential reads', async () => {
    const created = await authorized('post', '/api/v1/cases')
      .send({
        internalCode: 'D5-CONFIDENTIAL-001',
        title: 'Caso Confidencial Fictício D5',
        legalArea: 'TESTE',
        caseType: 'TESTE',
        confidentialityLevel: 'CONFIDENTIAL',
      })
      .expect(201);
    confidentialCaseId = created.body.id;

    await authorized('get', `/api/v1/cases/${confidentialCaseId}`).expect(200);
    await authorized('get', `/api/v1/cases/${confidentialCaseId}`, readOnlyToken).expect(404);
    const readOnlyList = await authorized('get', '/api/v1/cases', readOnlyToken).expect(200);
    assert.equal(
      readOnlyList.body.data.some((item) => item.id === confidentialCaseId),
      false,
    );

    const audits = await pool.query(
      `SELECT count(*)::int AS count FROM audit_logs
       WHERE organization_id = $1 AND entity_id = $2 AND action = 'case.confidential.read'`,
      [ORGANIZATION_ID, confidentialCaseId],
    );
    assert.ok(audits.rows[0].count > 0);
  });

  it('creates and lists validated participants without allowing cross-tenant relations', async () => {
    const participant = await authorized('post', `/api/v1/cases/${standardCaseId}/participants`)
      .send({ personId: individualId, role: 'reclamante', side: 'polo_ativo', isClient: true })
      .expect(201);
    assert.equal(participant.body.person.id, individualId);
    assert.equal(participant.body.side, 'polo_ativo');

    const list = await authorized('get', `/api/v1/cases/${standardCaseId}/participants`).expect(
      200,
    );
    assert.equal(
      list.body.data.some((item) => item.id === participant.body.id),
      true,
    );

    await authorized('post', `/api/v1/cases/${confidentialCaseId}/participants`)
      .send({ personId: individualId, role: 'testemunha', side: 'neutro', isClient: false })
      .expect(201);

    await authorized('post', `/api/v1/cases/${standardCaseId}/participants`)
      .send({ personId: individualId, role: 'reclamante', side: 'polo_ativo' })
      .expect(409);
    await authorized('post', `/api/v1/cases/${standardCaseId}/participants`)
      .send({
        personId: individualId,
        role: 'representante_legal',
        side: 'polo_ativo',
        isClient: false,
      })
      .expect(201);
    await authorized('post', `/api/v1/cases/${standardCaseId}/participants`)
      .send({ personId: OTHER_PERSON_ID, role: 'testemunha' })
      .expect(404);
    await authorized('post', `/api/v1/cases/${OTHER_CASE_ID}/participants`)
      .send({ personId: individualId, role: 'testemunha' })
      .expect(404);
    await authorized('get', `/api/v1/cases/${OTHER_CASE_ID}/participants`).expect(404);
  });

  it('lists person cases once with every relation while enforcing tenant, confidentiality, pagination, and RBAC', async () => {
    const firstPage = await authorized(
      'get',
      `/api/v1/persons/${individualId}/cases?limit=1`,
    ).expect(200);
    assert.equal(firstPage.body.data.length, 1);
    assert.equal(firstPage.body.pageInfo.hasNextPage, true);
    assert.ok(firstPage.body.pageInfo.nextCursor);

    const secondPage = await authorized(
      'get',
      `/api/v1/persons/${individualId}/cases?limit=1&cursor=${encodeURIComponent(firstPage.body.pageInfo.nextCursor)}`,
    ).expect(200);
    const allRows = [...firstPage.body.data, ...secondPage.body.data];
    assert.deepEqual(
      new Set(allRows.map((row) => row.case.id)),
      new Set([standardCaseId, confidentialCaseId]),
    );

    const standard = allRows.find((row) => row.case.id === standardCaseId);
    assert.ok(standard);
    assert.equal(standard.participations.length, 2);
    assert.deepEqual(
      standard.participations.map(({ role, side, isClient }) => ({ role, side, isClient })),
      [
        { role: 'reclamante', side: 'polo_ativo', isClient: true },
        { role: 'representante_legal', side: 'polo_ativo', isClient: false },
      ],
    );
    assert.equal('organizationId' in standard.case, false);

    const readOnly = await authorized(
      'get',
      `/api/v1/persons/${individualId}/cases?limit=1`,
      readOnlyToken,
    ).expect(200);
    assert.deepEqual(
      readOnly.body.data.map((row) => row.case.id),
      [standardCaseId],
    );
    assert.deepEqual(readOnly.body.pageInfo, { hasNextPage: false, nextCursor: null });

    await authorized('get', `/api/v1/persons/${OTHER_PERSON_ID}/cases`).expect(404);
    await authorized('get', `/api/v1/persons/${companyId}/cases`).expect(404);
    const invalidCursor = await authorized(
      'get',
      `/api/v1/persons/${individualId}/cases?cursor=not+base64`,
    ).expect(400);
    assert.equal(invalidCursor.body.code, 'INVALID_CURSOR');
    await authorized('get', `/api/v1/persons/${individualId}/cases`, noPermissionToken).expect(403);
  });

  it('denies mutations without granular permissions', async () => {
    await authorized('post', '/api/v1/persons', readOnlyToken)
      .send({ personType: 'INDIVIDUAL', fullName: 'Pessoa Fictícia D5 Negada' })
      .expect(403);
    await authorized('post', '/api/v1/cases', readOnlyToken)
      .send({
        internalCode: 'D5-DENIED-001',
        title: 'Caso Fictício D5 Negado',
        legalArea: 'TESTE',
        caseType: 'TESTE',
      })
      .expect(403);
    await authorized('patch', `/api/v1/cases/${standardCaseId}`, readOnlyToken)
      .send({ priority: 'URGENT' })
      .expect(403);
    await authorized('patch', `/api/v1/cases/${standardCaseId}/processing-budget`, readOnlyToken)
      .send({ limitAmount: '30' })
      .expect(403);
    await authorized('delete', `/api/v1/cases/${standardCaseId}`, readOnlyToken).expect(403);
  });

  it('stores only allowlisted resource audit data without personal or legal content', async () => {
    const result = await pool.query(
      `SELECT action, coalesce(old_data::text, '') || coalesce(new_data::text, '') AS data
       FROM audit_logs
       WHERE organization_id = $1
         AND (action LIKE 'person.%' OR action LIKE 'case.%' OR action LIKE 'case_participant.%')`,
      [ORGANIZATION_ID],
    );
    const serialized = result.rows.map((row) => `${row.action}:${row.data}`).join('\n');

    assert.ok(result.rowCount > 0);
    for (const prohibited of [
      TEST_CPF,
      TEST_CNPJ,
      'Pessoa Fictícia D5 Individual',
      'Caso Fictício D5 Padrão',
      'Descrição jurídica inteiramente fictícia.',
      'FICTICIO1234',
      // A auditoria sabe que o número do processo mudou, sem guardar qual: o registro é por
      // lista de campos permitidos, e o número não está nela.
      '0009999-84.2026.5.02.0001',
    ]) {
      assert.equal(serialized.includes(prohibited), false);
    }
  });
});
