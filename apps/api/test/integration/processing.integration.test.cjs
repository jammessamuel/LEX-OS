const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const path = require('node:path');
const { after, before, describe, it } = require('node:test');

const { NestFactory } = require('@nestjs/core');
const { Queue } = require('bullmq');
const request = require('supertest');

process.loadEnvFile(path.resolve(__dirname, '../../../../.env'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_HOST = '127.0.0.1';
process.env.DATABASE_PORT = '5433';
process.env.REDIS_HOST = '127.0.0.1';
process.env.PROCESSING_QUEUE_PREFIX = 'lex-os-processing-api-integration';

const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
const ADMIN_USER_ID = '00000000-0000-4000-8000-000000000002';
const DEMO_CASE_ID = '00000000-0000-4000-8000-000000000003';
const READ_ONLY_ROLE_ID = '00000000-0000-4000-8000-000000000106';
const READ_ONLY_USER_ID = '70000000-0000-4000-8000-000000000001';
const CONFIDENTIAL_CASE_ID = '70000000-0000-4000-8000-000000000002';
const OTHER_ORGANIZATION_ID = '70000000-0000-4000-8000-000000000003';
const OTHER_USER_ID = '70000000-0000-4000-8000-000000000004';
const OTHER_CASE_ID = '70000000-0000-4000-8000-000000000005';
const STANDARD_FILE_ID = '70000000-0000-4000-8000-000000000006';
const STANDARD_DOCUMENT_ID = '70000000-0000-4000-8000-000000000007';
const STANDARD_JOB_ID = '70000000-0000-4000-8000-000000000008';
const EXTRACTION_ID = '70000000-0000-4000-8000-000000000009';
const ENTITY_ID = '70000000-0000-4000-8000-000000000010';
const CONFIDENTIAL_FILE_ID = '70000000-0000-4000-8000-000000000011';
const CONFIDENTIAL_DOCUMENT_ID = '70000000-0000-4000-8000-000000000012';
const CONFIDENTIAL_JOB_ID = '70000000-0000-4000-8000-000000000013';
const OTHER_FILE_ID = '70000000-0000-4000-8000-000000000014';
const OTHER_DOCUMENT_ID = '70000000-0000-4000-8000-000000000015';
const OTHER_JOB_ID = '70000000-0000-4000-8000-000000000016';
const OTHER_EXTRACTION_ID = '70000000-0000-4000-8000-000000000017';
const OTHER_ENTITY_ID = '70000000-0000-4000-8000-000000000018';
const ADMIN_EMAIL = 'admin@lexos.invalid';
const READ_ONLY_EMAIL = 'd7-read-only@lexos.invalid';
const seedPassword = process.env.SEED_ADMIN_PASSWORD;

if (seedPassword === undefined) {
  throw new Error('SEED_ADMIN_PASSWORD is required for processing API integration tests.');
}

let app;
let http;
let database;
let adminToken;
let readOnlyToken;

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function login(email) {
  const response = await request(http)
    .post('/api/v1/auth/login')
    .send({ organizationId: ORGANIZATION_ID, email, password: seedPassword })
    .expect(200);
  return response.body.accessToken;
}

function authorized(token, method, route) {
  return request(http)[method](route).set('Authorization', `Bearer ${token}`);
}

async function cleanup() {
  if (database === undefined) {
    return;
  }
  const documentIds = [STANDARD_DOCUMENT_ID, CONFIDENTIAL_DOCUMENT_ID, OTHER_DOCUMENT_ID];
  await database.client.auditLog.deleteMany({
    where: {
      OR: [
        { processingJob: { documentId: { in: documentIds } } },
        { userId: READ_ONLY_USER_ID },
        { organizationId: OTHER_ORGANIZATION_ID },
        { entityId: { in: [CONFIDENTIAL_CASE_ID, OTHER_CASE_ID, ENTITY_ID, OTHER_ENTITY_ID] } },
      ],
    },
  });
  await database.client.refreshSession.deleteMany({ where: { userId: READ_ONLY_USER_ID } });
  await database.client.extractedEntity.deleteMany({ where: { documentId: { in: documentIds } } });
  await database.client.documentExtraction.deleteMany({
    where: { documentId: { in: documentIds } },
  });
  await database.client.processingJob.deleteMany({ where: { documentId: { in: documentIds } } });
  await database.client.document.deleteMany({ where: { id: { in: documentIds } } });
  await database.client.storedFile.deleteMany({
    where: { id: { in: [STANDARD_FILE_ID, CONFIDENTIAL_FILE_ID, OTHER_FILE_ID] } },
  });
  await database.client.case.deleteMany({
    where: { id: { in: [CONFIDENTIAL_CASE_ID, OTHER_CASE_ID] } },
  });
  await database.client.userRole.deleteMany({ where: { userId: READ_ONLY_USER_ID } });
  await database.client.user.deleteMany({
    where: { id: { in: [READ_ONLY_USER_ID, OTHER_USER_ID] } },
  });
  await database.client.organization.deleteMany({ where: { id: OTHER_ORGANIZATION_ID } });
}

async function createFileAndDocument({
  fileId,
  documentId,
  jobId,
  organizationId,
  userId,
  caseId,
}) {
  await database.client.storedFile.create({
    data: {
      id: fileId,
      organizationId,
      storageProvider: 'integration-test',
      storageBucket: 'integration-test',
      storageKey: `delivery-7-api/${fileId}`,
      originalFilename: 'documento-ficticio.txt',
      mimeType: 'text/plain',
      extension: 'txt',
      sizeBytes: 256,
      checksumSha256: hash(fileId),
      uploadedById: userId,
      uploadSource: 'INTEGRATION_TEST',
      virusScanStatus: 'CLEAN',
      status: 'AVAILABLE',
    },
  });
  await database.client.document.create({
    data: {
      id: documentId,
      organizationId,
      caseId,
      fileId,
      title: 'Documento fictício de processamento',
      classificationStatus: 'NEEDS_REVIEW',
      processingStatus: 'NEEDS_REVIEW',
    },
  });
  await database.client.processingJob.create({
    data: {
      id: jobId,
      organizationId,
      caseId,
      fileId,
      documentId,
      jobType: 'OCR',
      status: 'COMPLETED',
      attempts: 1,
      version: 2,
      provider: 'lex-os-mock-text',
      modelName: 'deterministic-v1',
      modelVersion: '1',
      costAmount: 0,
      costCurrency: 'BRL',
      inputMetadata: { privateSource: 'must-not-be-returned' },
      outputMetadata: { stage: 'OCR', progress: 50 },
      startedAt: new Date(Date.now() - 1000),
      finishedAt: new Date(),
    },
  });
}

before(async () => {
  const [{ AppModule }, { configureHttpPlatform }, { loadRuntimeConfig }, { DatabaseService }] =
    await Promise.all([
      import('../../dist/app.module.js'),
      import('../../dist/http/http-platform.js'),
      import('@lex-os/config'),
      import('../../dist/database/database.service.js'),
    ]);
  app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  configureHttpPlatform(app, loadRuntimeConfig());
  await app.init();
  http = app.getHttpServer();
  database = app.get(DatabaseService);
  await cleanup();

  const admin = await database.client.user.findUnique({
    where: { id: ADMIN_USER_ID },
    select: { passwordHash: true },
  });
  assert.ok(admin);
  await database.client.user.create({
    data: {
      id: READ_ONLY_USER_ID,
      organizationId: ORGANIZATION_ID,
      name: 'Leitor fictício D7',
      email: READ_ONLY_EMAIL,
      passwordHash: admin.passwordHash,
      status: 'ACTIVE',
    },
  });
  await database.client.userRole.create({
    data: { userId: READ_ONLY_USER_ID, roleId: READ_ONLY_ROLE_ID },
  });
  await database.client.case.create({
    data: {
      id: CONFIDENTIAL_CASE_ID,
      organizationId: ORGANIZATION_ID,
      internalCode: 'D7-CONFIDENTIAL-TEST',
      title: 'Caso confidencial fictício D7',
      legalArea: 'TESTE',
      caseType: 'TESTE',
      confidentialityLevel: 'CONFIDENTIAL',
    },
  });
  await database.client.organization.create({
    data: {
      id: OTHER_ORGANIZATION_ID,
      legalName: 'Outra organização fictícia D7',
      tradeName: 'Outra D7',
      documentNumber: '70000000000003',
      subscriptionPlan: 'TEST',
    },
  });
  await database.client.user.create({
    data: {
      id: OTHER_USER_ID,
      organizationId: OTHER_ORGANIZATION_ID,
      name: 'Outro usuário fictício D7',
      email: 'outro-d7@lexos.invalid',
      passwordHash: 'not-used',
      status: 'ACTIVE',
    },
  });
  await database.client.case.create({
    data: {
      id: OTHER_CASE_ID,
      organizationId: OTHER_ORGANIZATION_ID,
      internalCode: 'D7-OTHER-TENANT',
      title: 'Caso de outro tenant D7',
      legalArea: 'TESTE',
      caseType: 'TESTE',
    },
  });
  await createFileAndDocument({
    fileId: STANDARD_FILE_ID,
    documentId: STANDARD_DOCUMENT_ID,
    jobId: STANDARD_JOB_ID,
    organizationId: ORGANIZATION_ID,
    userId: ADMIN_USER_ID,
    caseId: DEMO_CASE_ID,
  });
  await createFileAndDocument({
    fileId: CONFIDENTIAL_FILE_ID,
    documentId: CONFIDENTIAL_DOCUMENT_ID,
    jobId: CONFIDENTIAL_JOB_ID,
    organizationId: ORGANIZATION_ID,
    userId: ADMIN_USER_ID,
    caseId: CONFIDENTIAL_CASE_ID,
  });
  await createFileAndDocument({
    fileId: OTHER_FILE_ID,
    documentId: OTHER_DOCUMENT_ID,
    jobId: OTHER_JOB_ID,
    organizationId: OTHER_ORGANIZATION_ID,
    userId: OTHER_USER_ID,
    caseId: OTHER_CASE_ID,
  });
  await database.client.documentExtraction.create({
    data: {
      id: EXTRACTION_ID,
      organizationId: ORGANIZATION_ID,
      documentId: STANDARD_DOCUMENT_ID,
      extractionType: 'ENTITY_EXTRACTION',
      provider: 'lex-os-mock-entities',
      modelName: 'deterministic-v1',
      modelVersion: '1',
      executionId: `mock-v1:${STANDARD_JOB_ID}`,
      status: 'COMPLETED',
      structuredData: { entityCount: 1 },
      confidenceScore: 0.98,
      processingTimeMs: 1,
      promptVersion: 'deterministic-prompt-v1',
    },
  });
  await database.client.extractedEntity.create({
    data: {
      id: ENTITY_ID,
      organizationId: ORGANIZATION_ID,
      documentId: STANDARD_DOCUMENT_ID,
      extractionId: EXTRACTION_ID,
      entityType: 'CONTRACT_NUMBER',
      normalizedValue: 'LEX-2026-0001',
      originalValue: 'LEX-2026-0001',
      pageNumber: 1,
      startOffset: 19,
      endOffset: 32,
      confidenceScore: 0.99,
      metadata: { source: 'DETERMINISTIC_MOCK' },
    },
  });
  await database.client.documentExtraction.create({
    data: {
      id: OTHER_EXTRACTION_ID,
      organizationId: OTHER_ORGANIZATION_ID,
      documentId: OTHER_DOCUMENT_ID,
      extractionType: 'ENTITY_EXTRACTION',
      provider: 'lex-os-mock-entities',
      modelName: 'deterministic-v1',
      executionId: `mock-v1:${OTHER_JOB_ID}`,
      status: 'COMPLETED',
    },
  });
  await database.client.extractedEntity.create({
    data: {
      id: OTHER_ENTITY_ID,
      organizationId: OTHER_ORGANIZATION_ID,
      documentId: OTHER_DOCUMENT_ID,
      extractionId: OTHER_EXTRACTION_ID,
      entityType: 'CONTRACT_NUMBER',
      normalizedValue: 'OTHER-TENANT-VALUE',
      originalValue: 'OTHER-TENANT-VALUE',
    },
  });

  adminToken = await login(ADMIN_EMAIL);
  readOnlyToken = await login(READ_ONLY_EMAIL);
});

after(async () => {
  await cleanup();
  await app?.close();
  const queues = [
    'checklist-analysis',
    'document-classification',
    'entity-extraction',
    'file-validation',
    'ocr-processing',
    'timeline-generation',
    'virus-scan',
  ].map(
    (name) =>
      new Queue(name, {
        prefix: process.env.PROCESSING_QUEUE_PREFIX,
        connection: {
          host: '127.0.0.1',
          port: Number(process.env.REDIS_PORT),
          password: process.env.REDIS_PASSWORD,
          maxRetriesPerRequest: 1,
        },
      }),
  );
  await Promise.all(queues.map((queue) => queue.obliterate({ force: true })));
  await Promise.all(queues.map((queue) => queue.close()));
});

describe('Delivery 7 processing HTTP contract', () => {
  it('publishes all progress, extraction, and reprocessing routes', async () => {
    const response = await request(http).get('/api/v1/docs/openapi.json').expect(200);
    assert.ok(response.body.paths['/api/v1/processing-jobs']?.get);
    assert.ok(response.body.paths['/api/v1/processing-jobs/{id}']?.get);
    assert.ok(response.body.paths['/api/v1/documents/{id}/extractions']?.get);
    assert.ok(response.body.paths['/api/v1/extracted-entities/{id}/confirm']?.post);
    assert.ok(response.body.paths['/api/v1/documents/{id}/reprocess']?.post);
  });

  it('lists and reads safe job progress with keyset pagination', async () => {
    const first = await authorized(adminToken, 'get', '/api/v1/processing-jobs?limit=1').expect(
      200,
    );
    assert.equal(first.body.data.length, 1);
    assert.equal(first.body.pageInfo.hasNextPage, true);
    assert.ok(first.body.pageInfo.nextCursor);
    assert.equal('inputMetadata' in first.body.data[0], false);

    const detail = await authorized(
      adminToken,
      'get',
      `/api/v1/processing-jobs/${STANDARD_JOB_ID}`,
    ).expect(200);
    assert.equal(detail.body.status, 'COMPLETED');
    assert.equal(detail.body.modelVersion, '1');
    assert.equal(detail.body.reservedCostAmount, '0.000000');
    assert.equal(detail.body.costAmount, '0.000000');
    assert.equal(detail.body.costCurrency, 'BRL');
    assert.deepEqual(detail.body.outputMetadata, { stage: 'OCR', progress: 50 });
    assert.equal('inputMetadata' in detail.body, false);

    const byProvider = await authorized(
      adminToken,
      'get',
      '/api/v1/processing-jobs?provider=lex-os-mock-text&modelName=deterministic-v1',
    ).expect(200);
    assert.ok(byProvider.body.data.length >= 1);
    assert.equal(
      byProvider.body.data.some((job) => job.id === STANDARD_JOB_ID),
      true,
    );
    assert.equal(
      byProvider.body.data.every(
        (job) => job.provider === 'lex-os-mock-text' && job.modelName === 'deterministic-v1',
      ),
      true,
    );
    await authorized(adminToken, 'get', '/api/v1/processing-jobs?provider=bad!').expect(400);
  });

  it('returns append-only extraction provenance and entities without storage metadata', async () => {
    const response = await authorized(
      readOnlyToken,
      'get',
      `/api/v1/documents/${STANDARD_DOCUMENT_ID}/extractions`,
    ).expect(200);
    assert.equal(response.body.data.length, 1);
    assert.equal(response.body.data[0].provider, 'lex-os-mock-entities');
    assert.equal(response.body.data[0].entities.length, 1);
    assert.equal(response.body.data[0].entities[0].entityType, 'CONTRACT_NUMBER');
    assert.equal(response.body.data[0].entities[0].confirmedByUser, false);
    assert.equal(response.body.data[0].entities[0].confirmedById, null);
    assert.equal(response.body.data[0].entities[0].confirmedAt, null);
    assert.equal('storageKey' in response.body.data[0], false);
  });

  it('confirms an extracted entity once without changing its source values', async () => {
    await authorized(
      readOnlyToken,
      'post',
      `/api/v1/extracted-entities/${ENTITY_ID}/confirm`,
    ).expect(403);
    await authorized(adminToken, 'post', '/api/v1/extracted-entities/not-a-uuid/confirm').expect(
      400,
    );
    await authorized(
      adminToken,
      'post',
      `/api/v1/extracted-entities/${OTHER_ENTITY_ID}/confirm`,
    ).expect(404);

    const responses = await Promise.all([
      authorized(adminToken, 'post', `/api/v1/extracted-entities/${ENTITY_ID}/confirm`),
      authorized(adminToken, 'post', `/api/v1/extracted-entities/${ENTITY_ID}/confirm`),
    ]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
    const confirmed = responses.find((response) => response.status === 200);
    assert.equal(confirmed?.body.confirmedByUser, true);
    assert.equal(confirmed?.body.confirmedById, ADMIN_USER_ID);
    assert.ok(confirmed?.body.confirmedAt);
    assert.equal(confirmed?.body.normalizedValue, 'LEX-2026-0001');
    assert.equal(confirmed?.body.originalValue, 'LEX-2026-0001');

    const persisted = await database.client.extractedEntity.findUniqueOrThrow({
      where: { id: ENTITY_ID },
    });
    assert.equal(persisted.normalizedValue, 'LEX-2026-0001');
    assert.equal(persisted.originalValue, 'LEX-2026-0001');
    const audit = await database.client.auditLog.findFirst({
      where: { entityId: ENTITY_ID, action: 'extracted_entity.confirmed' },
      select: { oldData: true, newData: true },
    });
    assert.deepEqual(audit?.oldData, { confirmedByUser: false });
    assert.equal(JSON.stringify(audit).includes('LEX-2026-0001'), false);
  });

  it('creates one queued reprocessing root and rejects a concurrent duplicate', async () => {
    const accepted = await authorized(
      adminToken,
      'post',
      `/api/v1/documents/${STANDARD_DOCUMENT_ID}/reprocess`,
    ).expect(202);
    assert.equal(accepted.body.jobType, 'OCR');
    assert.equal(accepted.body.status, 'QUEUED');
    assert.notEqual(accepted.body.id, STANDARD_JOB_ID);
    await authorized(
      adminToken,
      'post',
      `/api/v1/documents/${STANDARD_DOCUMENT_ID}/reprocess`,
    ).expect(409);
    await authorized(
      readOnlyToken,
      'post',
      `/api/v1/documents/${STANDARD_DOCUMENT_ID}/reprocess`,
    ).expect(403);
  });

  it('hides other tenants and confidential jobs from unauthorized readers', async () => {
    await authorized(adminToken, 'get', `/api/v1/processing-jobs/${OTHER_JOB_ID}`).expect(404);
    await authorized(
      adminToken,
      'get',
      `/api/v1/documents/${OTHER_DOCUMENT_ID}/extractions`,
    ).expect(404);
    await authorized(adminToken, 'post', `/api/v1/documents/${OTHER_DOCUMENT_ID}/reprocess`).expect(
      404,
    );

    const adminList = await authorized(
      adminToken,
      'get',
      '/api/v1/processing-jobs?limit=100',
    ).expect(200);
    assert.equal(
      adminList.body.data.some((job) => job.id === OTHER_JOB_ID),
      false,
    );
    assert.equal(
      adminList.body.data.some((job) => job.id === CONFIDENTIAL_JOB_ID),
      true,
    );

    const list = await authorized(readOnlyToken, 'get', '/api/v1/processing-jobs?limit=100').expect(
      200,
    );
    assert.equal(
      list.body.data.some((job) => job.id === CONFIDENTIAL_JOB_ID),
      false,
    );
    await authorized(readOnlyToken, 'get', `/api/v1/processing-jobs/${CONFIDENTIAL_JOB_ID}`).expect(
      404,
    );
    await authorized(
      readOnlyToken,
      'get',
      `/api/v1/documents/${CONFIDENTIAL_DOCUMENT_ID}/extractions`,
    ).expect(404);
    await authorized(
      adminToken,
      'get',
      `/api/v1/documents/${CONFIDENTIAL_DOCUMENT_ID}/extractions`,
    ).expect(200);

    await database.client.document.update({
      where: { id: CONFIDENTIAL_DOCUMENT_ID },
      data: { deletedAt: new Date() },
    });
    await authorized(
      adminToken,
      'get',
      `/api/v1/documents/${CONFIDENTIAL_DOCUMENT_ID}/extractions`,
    ).expect(404);
    await authorized(adminToken, 'get', `/api/v1/processing-jobs/${CONFIDENTIAL_JOB_ID}`).expect(
      404,
    );
    await authorized(
      adminToken,
      'post',
      `/api/v1/documents/${CONFIDENTIAL_DOCUMENT_ID}/reprocess`,
    ).expect(404);
  });
});
