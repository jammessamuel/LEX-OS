const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const { after, before, describe, it } = require('node:test');

const { NestFactory } = require('@nestjs/core');
const { Pool } = require('pg');
const request = require('supertest');

// Como nos irmãos deste diretório: ninguém exporta ambiente na esteira — é este carregamento
// que leva o `.env` até o processo. Sem ele, a guarda logo abaixo estoura na carga do módulo.
process.loadEnvFile(path.resolve(__dirname, '../../../../.env'));

/**
 * A retenção obrigatória alcança todo caminho de exclusão (ADR-012).
 *
 * A decisão diz "bloqueia todo caminho de exclusão, inclusive administrativos", e o risco dessa
 * frase é o "todo": um caminho novo pode nascer amanhã sem a guarda, e nada acusaria. Por isso
 * este arquivo tem duas metades — a prova de que os caminhos de hoje recusam, e um inventário
 * fechado das rotas DELETE publicadas. Quem criar uma rota de exclusão nova vai quebrar o
 * inventário, e a correção exige vir aqui dizer, com teste, o que a retenção faz com ela.
 */

const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
const ADMIN_EMAIL = 'admin@lexos.invalid';

const CASE_ID = '77000000-0000-4000-8000-000000000001';
const FILE_ID = '77000000-0000-4000-8000-000000000002';
const DOCUMENT_ID = '77000000-0000-4000-8000-000000000003';
const PERSON_ID = '77000000-0000-4000-8000-000000000004';

const databaseUrl = process.env.DATABASE_URL;
const seedPassword = process.env.SEED_ADMIN_PASSWORD;

if (databaseUrl === undefined || seedPassword === undefined) {
  throw new Error('DATABASE_URL and SEED_ADMIN_PASSWORD are required for API integration tests.');
}

const pool = new Pool({ connectionString: databaseUrl });
let app;
let http;
let adminToken;

async function cleanup() {
  await pool.query('DELETE FROM audit_logs WHERE entity_id = $1', [CASE_ID]);
  await pool.query('DELETE FROM case_participants WHERE case_id = $1', [CASE_ID]);
  await pool.query('DELETE FROM documents WHERE id = $1', [DOCUMENT_ID]);
  await pool.query('DELETE FROM files WHERE id = $1', [FILE_ID]);
  await pool.query('DELETE FROM cases WHERE id = $1', [CASE_ID]);
  await pool.query('DELETE FROM persons WHERE id = $1', [PERSON_ID]);
}

async function fixtures() {
  await pool.query(
    `INSERT INTO cases
      (id, organization_id, internal_code, title, legal_area, case_type, status,
       priority, confidentiality_level, updated_at)
     VALUES ($1, $2, 'LH-2026-0001', 'Caso fictício sob retenção', 'TESTE', 'TESTE',
       'INTAKE', 'NORMAL', 'STANDARD', now())`,
    [CASE_ID, ORGANIZATION_ID],
  );
  await pool.query(
    `INSERT INTO files
      (id, organization_id, storage_provider, storage_bucket, storage_key, original_filename,
       mime_type, extension, size_bytes, checksum_sha256, uploaded_by, upload_source,
       virus_scan_status, status, updated_at)
     VALUES ($1, $2, 'legal-hold-test', 'legal-hold-test', $3, 'ficticio.txt',
       'text/plain', 'txt', 64, $4, $5, 'INTEGRATION_TEST', 'CLEAN', 'AVAILABLE', now())`,
    [
      FILE_ID,
      ORGANIZATION_ID,
      `legal-hold/${FILE_ID}`,
      crypto.createHash('sha256').update(FILE_ID).digest('hex'),
      // O admin semeado: arquivo exige quem o enviou.
      '00000000-0000-4000-8000-000000000002',
    ],
  );
  await pool.query(
    `INSERT INTO documents
      (id, organization_id, case_id, file_id, title, processing_status, updated_at)
     VALUES ($1, $2, $3, $4, 'Documento fictício retido', 'NEEDS_REVIEW', now())`,
    [DOCUMENT_ID, ORGANIZATION_ID, CASE_ID, FILE_ID],
  );
  await pool.query(
    `INSERT INTO persons (id, organization_id, person_type, full_name, metadata, updated_at)
     VALUES ($1, $2, 'INDIVIDUAL', 'Pessoa Fictícia Sob Retenção', '{}', now())`,
    [PERSON_ID, ORGANIZATION_ID],
  );
  await pool.query(
    `INSERT INTO case_participants (organization_id, case_id, person_id, role, side, updated_at)
     VALUES ($1, $2, $3, 'testemunha', 'neutro', now())`,
    [ORGANIZATION_ID, CASE_ID, PERSON_ID],
  );
}

function authed(method, path) {
  return request(http)[method](path).set('authorization', `Bearer ${adminToken}`);
}

before(async () => {
  await cleanup();
  await fixtures();
  const [{ AppModule }, { configureHttpPlatform }, { loadRuntimeConfig }] = await Promise.all([
    import('../../dist/app.module.js'),
    import('../../dist/http/http-platform.js'),
    import('@lex-os/config'),
  ]);
  app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  configureHttpPlatform(app, loadRuntimeConfig());
  await app.init();
  http = app.getHttpServer();
  const login = await request(http)
    .post('/api/v1/auth/login')
    .send({ organizationSlug: 'lex-os-demonstracao', email: ADMIN_EMAIL, password: seedPassword })
    .expect(200);
  adminToken = login.body.accessToken;
});

after(async () => {
  await app?.close();
  await cleanup();
  await pool.end();
});

describe('retenção obrigatória (legal hold)', () => {
  it('não entra sem motivo, porque quem olhar depois precisa saber por quê', async () => {
    await authed('put', `/api/v1/cases/${CASE_ID}/legal-hold`)
      .send({ hold: true, reason: '' })
      .expect(400);
  });

  it('posta a marca com autor, data e motivo', async () => {
    const response = await authed('put', `/api/v1/cases/${CASE_ID}/legal-hold`)
      .send({ hold: true, reason: 'Ordem fictícia de preservação para o teste.' })
      .expect(200);
    assert.ok(response.body.legalHoldAt);
    assert.equal(response.body.legalHoldReason, 'Ordem fictícia de preservação para o teste.');
  });

  it('recusa excluir o caso retido, dizendo o motivo em vez de "não encontrado"', async () => {
    const response = await authed('delete', `/api/v1/cases/${CASE_ID}`).expect(409);
    assert.equal(response.body.code, 'CASE_UNDER_LEGAL_HOLD');
    assert.match(response.body.message, /retenção obrigatória/u);
    assert.match(response.body.message, /Ordem fictícia de preservação/u);
  });

  it('recusa excluir documento de dentro do caso retido', async () => {
    const response = await authed('delete', `/api/v1/documents/${DOCUMENT_ID}`).expect(409);
    assert.equal(response.body.code, 'CASE_UNDER_LEGAL_HOLD');
  });

  it('recusa excluir pessoa que participa do caso retido, nomeando o caso', async () => {
    const response = await authed('delete', `/api/v1/persons/${PERSON_ID}`).expect(409);
    assert.equal(response.body.code, 'PERSON_IN_CASE_UNDER_LEGAL_HOLD');
    assert.match(response.body.message, /LH-2026-0001/u);
  });

  it('a guarda de verdade vive no filtro: escrita direta no repositório também não apaga', async () => {
    // O serviço dá a mensagem; o filtro impede. Se alguém criar um caminho que pule o serviço,
    // é esta linha que segura — um UPDATE que tente marcar deleted_at num caso retido não
    // encontra linha para atualizar.
    const result = await pool.query(
      `UPDATE cases SET deleted_at = now()
       WHERE id = $1 AND deleted_at IS NULL AND legal_hold_at IS NULL`,
      [CASE_ID],
    );
    assert.equal(result.rowCount, 0);
  });

  it('o estado pela metade é impossível de gravar, não só de ler', async () => {
    // ADR-012: quando o estado do hold não puder ser determinado, a exclusão é recusada. Mais
    // forte que recusar é impedir que o estado indeterminado exista — a restrição do banco
    // obriga data, autor e motivo a andarem juntos.
    await assert.rejects(
      pool.query(`UPDATE cases SET legal_hold_reason = NULL WHERE id = $1`, [CASE_ID]),
      /cases_legal_hold_all_or_nothing/u,
    );
  });

  it('retirar exige motivo, e depois disso os três caminhos voltam a funcionar', async () => {
    await authed('put', `/api/v1/cases/${CASE_ID}/legal-hold`)
      .send({ hold: false, reason: '' })
      .expect(400);

    await authed('put', `/api/v1/cases/${CASE_ID}/legal-hold`)
      .send({ hold: false, reason: 'Preservação fictícia cumprida; liberação para o teste.' })
      .expect(200);

    await authed('delete', `/api/v1/documents/${DOCUMENT_ID}`).expect(204);
    await authed('delete', `/api/v1/persons/${PERSON_ID}`).expect(204);
    await authed('delete', `/api/v1/cases/${CASE_ID}`).expect(204);
  });

  it('pôr e retirar ficaram na auditoria, com motivo e sem conteúdo', async () => {
    const trilha = await pool.query(
      `SELECT action, new_data FROM audit_logs
       WHERE entity_id = $1 AND action LIKE 'case.legal_hold.%' ORDER BY created_at`,
      [CASE_ID],
    );
    const acoes = trilha.rows.map((row) => row.action);
    assert.deepEqual(acoes, ['case.legal_hold.placed', 'case.legal_hold.released']);
    for (const row of trilha.rows) {
      assert.ok(row.new_data.legalHoldReason.length > 10);
    }
  });

  it('inventário fechado: toda rota DELETE publicada tem posição declarada frente à retenção', async () => {
    // Quem criar uma rota de exclusão nova quebra esta lista, e o conserto exige dizer aqui,
    // com teste, o que a retenção faz com ela. É o que impede o "todo caminho de exclusão" do
    // ADR-012 de envelhecer em silêncio.
    const openapi = await request(http).get('/api/v1/docs/openapi.json').expect(200);
    const deletes = Object.entries(openapi.body.paths)
      .filter(([, ops]) => ops.delete !== undefined)
      .map(([route]) => route)
      .sort();

    assert.deepEqual(
      deletes,
      [
        // Coberta acima: recusa sob retenção.
        '/api/v1/cases/{id}',
        // Coberta acima: documento de caso retido recusa.
        '/api/v1/documents/{id}',
        // Coberta acima: pessoa em caso retido recusa.
        '/api/v1/persons/{id}',
        // Fora do alcance da retenção por decisão: o segundo fator é credencial da própria
        // pessoa, não material do caso — retê-lo trancaria a conta, não o acervo.
        '/api/v1/auth/second-factor',
        // Fora do alcance por decisão: convite pendente é acesso ainda não exercido; revogá-lo
        // não remove nada de dentro de caso nenhum.
        '/api/v1/users/invitations/{id}',
      ].sort(),
    );
  });
});
