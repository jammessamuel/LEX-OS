const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const path = require('node:path');
const { after, before, describe, it } = require('node:test');

const { NestFactory } = require('@nestjs/core');
const request = require('supertest');

process.loadEnvFile(path.resolve(__dirname, '../../../../.env'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_HOST = '127.0.0.1';
process.env.DATABASE_PORT = '5433';
process.env.REDIS_HOST = '127.0.0.1';
process.env.PROCESSING_QUEUE_PREFIX = 'lex-os-review-api-integration';

const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
const ADMIN_USER_ID = '00000000-0000-4000-8000-000000000002';
const DEMO_CASE_ID = '80000000-0000-4000-8000-000000000018';
const INTERN_ROLE_ID = '00000000-0000-4000-8000-000000000105';
const TEMPLATE_ID = '00000000-0000-4000-8000-000000000401';
const INTERN_USER_ID = '80000000-0000-4000-8000-000000000001';
const STANDARD_FILE_ID = '80000000-0000-4000-8000-000000000002';
const STANDARD_DOCUMENT_ID = '80000000-0000-4000-8000-000000000003';
const STANDARD_EXTRACTION_ID = '80000000-0000-4000-8000-000000000004';
const STANDARD_EVENT_ID = '80000000-0000-4000-8000-000000000005';
const AUXILIARY_CASE_ID = '80000000-0000-4000-8000-000000000006';
const AUXILIARY_FILE_ID = '80000000-0000-4000-8000-000000000007';
const AUXILIARY_DOCUMENT_ID = '80000000-0000-4000-8000-000000000008';
const OTHER_ORGANIZATION_ID = '80000000-0000-4000-8000-000000000009';
const OTHER_USER_ID = '80000000-0000-4000-8000-000000000010';
const OTHER_CASE_ID = '80000000-0000-4000-8000-000000000011';
const OTHER_FILE_ID = '80000000-0000-4000-8000-000000000012';
const OTHER_DOCUMENT_ID = '80000000-0000-4000-8000-000000000013';
const OTHER_EXTRACTION_ID = '80000000-0000-4000-8000-000000000014';
const OTHER_EVENT_ID = '80000000-0000-4000-8000-000000000015';
const OTHER_CHECKLIST_ID = '80000000-0000-4000-8000-000000000016';
const OTHER_CHECKLIST_ITEM_ID = '80000000-0000-4000-8000-000000000017';
const OTHER_TASK_ID = '80000000-0000-4000-8000-000000000019';
const CONFIDENTIAL_CASE_ID = '80000000-0000-4000-8000-000000000020';
const DELETED_CASE_ID = '80000000-0000-4000-8000-000000000021';
const ADMIN_EMAIL = 'admin@lexos.invalid';
const INTERN_EMAIL = 'd8-intern@lexos.invalid';
const seedPassword = process.env.SEED_ADMIN_PASSWORD;

if (seedPassword === undefined) {
  throw new Error('SEED_ADMIN_PASSWORD is required for review API integration tests.');
}

let app;
let http;
let database;
let adminToken;
let internToken;
let taskId;

function checksum(value) {
  return createHash('sha256').update(value).digest('hex');
}

function authorized(token, method, route) {
  return request(http)[method](route).set('Authorization', `Bearer ${token}`);
}

async function login(email) {
  const response = await request(http)
    .post('/api/v1/auth/login')
    .send({ organizationId: ORGANIZATION_ID, email, password: seedPassword })
    .expect(200);
  return response.body.accessToken;
}

async function cleanup() {
  if (database === undefined) {
    return;
  }
  await database.client.checklistTemplate.updateMany({
    where: { id: TEMPLATE_ID },
    data: { isActive: true },
  });
  const fixtureChecklists = await database.client.caseChecklist.findMany({
    where: { caseId: { in: [DEMO_CASE_ID, OTHER_CASE_ID] } },
    select: { id: true, items: { select: { id: true } } },
  });
  const fixtureChecklistIds = fixtureChecklists.map((item) => item.id);
  const fixtureItemIds = fixtureChecklists.flatMap((item) => item.items.map((child) => child.id));
  const fixtureTasks = await database.client.task.findMany({
    where: { caseId: { in: [DEMO_CASE_ID, OTHER_CASE_ID] } },
    select: { id: true },
  });
  await database.client.auditLog.deleteMany({
    where: {
      OR: [
        { userId: INTERN_USER_ID },
        { organizationId: OTHER_ORGANIZATION_ID },
        {
          entityId: {
            in: [
              STANDARD_EVENT_ID,
              OTHER_EVENT_ID,
              CONFIDENTIAL_CASE_ID,
              DELETED_CASE_ID,
              ...fixtureChecklistIds,
              ...fixtureItemIds,
              ...fixtureTasks.map((item) => item.id),
            ],
          },
        },
      ],
    },
  });
  await database.client.refreshSession.deleteMany({ where: { userId: INTERN_USER_ID } });
  await database.client.task.deleteMany({
    where: { caseId: { in: [DEMO_CASE_ID, OTHER_CASE_ID] } },
  });
  await database.client.timelineEvent.deleteMany({
    where: { id: { in: [STANDARD_EVENT_ID, OTHER_EVENT_ID] } },
  });
  await database.client.caseChecklistItem.deleteMany({
    where: { caseChecklistId: { in: fixtureChecklistIds } },
  });
  await database.client.caseChecklist.deleteMany({
    where: { id: { in: fixtureChecklistIds } },
  });
  await database.client.documentExtraction.deleteMany({
    where: { id: { in: [STANDARD_EXTRACTION_ID, OTHER_EXTRACTION_ID] } },
  });
  await database.client.document.deleteMany({
    where: { id: { in: [STANDARD_DOCUMENT_ID, AUXILIARY_DOCUMENT_ID, OTHER_DOCUMENT_ID] } },
  });
  await database.client.storedFile.deleteMany({
    where: { id: { in: [STANDARD_FILE_ID, AUXILIARY_FILE_ID, OTHER_FILE_ID] } },
  });
  await database.client.case.deleteMany({
    where: {
      id: {
        in: [DEMO_CASE_ID, AUXILIARY_CASE_ID, OTHER_CASE_ID, CONFIDENTIAL_CASE_ID, DELETED_CASE_ID],
      },
    },
  });
  await database.client.userRole.deleteMany({ where: { userId: INTERN_USER_ID } });
  await database.client.user.deleteMany({
    where: { id: { in: [INTERN_USER_ID, OTHER_USER_ID] } },
  });
  await database.client.organization.deleteMany({ where: { id: OTHER_ORGANIZATION_ID } });
}

async function createFileAndDocument({ fileId, documentId, organizationId, userId, caseId }) {
  await database.client.storedFile.create({
    data: {
      id: fileId,
      organizationId,
      storageProvider: 'integration-test',
      storageBucket: 'integration-test',
      storageKey: `delivery-8-api/${fileId}`,
      originalFilename: 'documento-ficticio.txt',
      mimeType: 'text/plain',
      extension: 'txt',
      sizeBytes: 256,
      checksumSha256: checksum(fileId),
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
      title: 'Documento fictício de revisão',
      classificationStatus: 'NEEDS_REVIEW',
      processingStatus: 'NEEDS_REVIEW',
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

  const [admin, templateItem, otherDocumentType] = await Promise.all([
    database.client.user.findUnique({
      where: { id: ADMIN_USER_ID },
      select: { passwordHash: true },
    }),
    database.client.checklistTemplateItem.findFirst({
      where: { templateId: TEMPLATE_ID },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, title: true, description: true, isRequired: true },
    }),
    database.client.documentType.findFirst({
      where: { code: 'OUTRO', organizationId: null },
      select: { id: true },
    }),
  ]);
  assert.ok(admin && templateItem && otherDocumentType);

  await database.client.user.create({
    data: {
      id: INTERN_USER_ID,
      organizationId: ORGANIZATION_ID,
      name: 'Estagiário fictício D8',
      email: INTERN_EMAIL,
      passwordHash: admin.passwordHash,
      status: 'ACTIVE',
    },
  });
  await database.client.userRole.create({
    data: { userId: INTERN_USER_ID, roleId: INTERN_ROLE_ID },
  });
  await database.client.case.create({
    data: {
      id: DEMO_CASE_ID,
      organizationId: ORGANIZATION_ID,
      internalCode: 'D8-PRIMARY',
      title: 'Caso principal fictício D8',
      legalArea: 'TRABALHISTA',
      caseType: 'RECLAMACAO_TRABALHISTA',
    },
  });
  await database.client.case.create({
    data: {
      id: CONFIDENTIAL_CASE_ID,
      organizationId: ORGANIZATION_ID,
      internalCode: 'D8-CONFIDENTIAL',
      title: 'Caso confidencial fictício D8',
      legalArea: 'TESTE',
      caseType: 'TESTE',
      confidentialityLevel: 'CONFIDENTIAL',
    },
  });
  await database.client.case.create({
    data: {
      id: DELETED_CASE_ID,
      organizationId: ORGANIZATION_ID,
      internalCode: 'D8-DELETED',
      title: 'Caso excluído fictício D8',
      legalArea: 'TESTE',
      caseType: 'TESTE',
      deletedAt: new Date(),
    },
  });
  await database.client.case.create({
    data: {
      id: AUXILIARY_CASE_ID,
      organizationId: ORGANIZATION_ID,
      internalCode: 'D8-AUXILIARY',
      title: 'Caso auxiliar fictício D8',
      legalArea: 'TRABALHISTA',
      caseType: 'RECLAMACAO_TRABALHISTA',
    },
  });
  await database.client.organization.create({
    data: {
      id: OTHER_ORGANIZATION_ID,
      legalName: 'Outra organização fictícia D8',
      tradeName: 'Outra D8',
      documentNumber: '80000000000009',
      subscriptionPlan: 'TEST',
    },
  });
  await database.client.user.create({
    data: {
      id: OTHER_USER_ID,
      organizationId: OTHER_ORGANIZATION_ID,
      name: 'Outro usuário fictício D8',
      email: 'outro-d8@lexos.invalid',
      passwordHash: 'not-used',
      status: 'ACTIVE',
    },
  });
  await database.client.case.create({
    data: {
      id: OTHER_CASE_ID,
      organizationId: OTHER_ORGANIZATION_ID,
      internalCode: 'D8-OTHER-TENANT',
      title: 'Caso de outro tenant D8',
      legalArea: 'TRABALHISTA',
      caseType: 'RECLAMACAO_TRABALHISTA',
    },
  });
  await database.client.task.create({
    data: {
      id: OTHER_TASK_ID,
      organizationId: OTHER_ORGANIZATION_ID,
      caseId: OTHER_CASE_ID,
      title: 'Tarefa fictícia de outro tenant',
      taskType: 'TEST',
      status: 'OPEN',
      sourceType: 'USER',
      createdById: OTHER_USER_ID,
    },
  });

  await createFileAndDocument({
    fileId: STANDARD_FILE_ID,
    documentId: STANDARD_DOCUMENT_ID,
    organizationId: ORGANIZATION_ID,
    userId: ADMIN_USER_ID,
    caseId: DEMO_CASE_ID,
  });
  await database.client.document.update({
    where: { id: STANDARD_DOCUMENT_ID },
    data: { documentTypeId: otherDocumentType.id },
  });
  await createFileAndDocument({
    fileId: AUXILIARY_FILE_ID,
    documentId: AUXILIARY_DOCUMENT_ID,
    organizationId: ORGANIZATION_ID,
    userId: ADMIN_USER_ID,
    caseId: AUXILIARY_CASE_ID,
  });
  await createFileAndDocument({
    fileId: OTHER_FILE_ID,
    documentId: OTHER_DOCUMENT_ID,
    organizationId: OTHER_ORGANIZATION_ID,
    userId: OTHER_USER_ID,
    caseId: OTHER_CASE_ID,
  });
  await database.client.documentExtraction.createMany({
    data: [
      {
        id: STANDARD_EXTRACTION_ID,
        organizationId: ORGANIZATION_ID,
        documentId: STANDARD_DOCUMENT_ID,
        extractionType: 'TIMELINE_ANALYSIS',
        provider: 'lex-os-mock-timeline',
        modelName: 'deterministic-v1',
        modelVersion: '1',
        executionId: `fixture:${STANDARD_EVENT_ID}`,
        status: 'COMPLETED',
        structuredData: { sourceExtractionId: 'fixture' },
        confidenceScore: 0.98,
        processingTimeMs: 1,
        promptVersion: 'timeline-mock-v1',
      },
      {
        id: OTHER_EXTRACTION_ID,
        organizationId: OTHER_ORGANIZATION_ID,
        documentId: OTHER_DOCUMENT_ID,
        extractionType: 'TIMELINE_ANALYSIS',
        provider: 'lex-os-mock-timeline',
        modelName: 'deterministic-v1',
        modelVersion: '1',
        executionId: `fixture:${OTHER_EVENT_ID}`,
        status: 'COMPLETED',
        confidenceScore: 0.98,
        processingTimeMs: 1,
        promptVersion: 'timeline-mock-v1',
      },
    ],
  });
  await database.client.timelineEvent.createMany({
    data: [
      {
        id: STANDARD_EVENT_ID,
        organizationId: ORGANIZATION_ID,
        caseId: DEMO_CASE_ID,
        eventType: 'CONTRACT_DATE',
        title: 'Celebração do contrato fictício',
        description: 'Data contratual identificada na fixture.',
        occurredAt: new Date('2026-08-05T00:00:00.000Z'),
        datePrecision: 'DAY',
        importance: 'NORMAL',
        sourceType: 'DOCUMENT',
        sourceId: STANDARD_DOCUMENT_ID,
        sourceLocator: { pageNumber: 1, startOffset: 47, endOffset: 57 },
        extractionId: STANDARD_EXTRACTION_ID,
        confidenceScore: 0.98,
        createdByActorType: 'AI',
      },
      {
        id: OTHER_EVENT_ID,
        organizationId: OTHER_ORGANIZATION_ID,
        caseId: OTHER_CASE_ID,
        eventType: 'CONTRACT_DATE',
        title: 'Evento de outro tenant',
        description: 'Fixture externa.',
        occurredAt: new Date('2026-08-05T00:00:00.000Z'),
        datePrecision: 'DAY',
        importance: 'NORMAL',
        sourceType: 'DOCUMENT',
        sourceId: OTHER_DOCUMENT_ID,
        sourceLocator: { pageNumber: 1, startOffset: 47, endOffset: 57 },
        extractionId: OTHER_EXTRACTION_ID,
        confidenceScore: 0.98,
        createdByActorType: 'AI',
      },
    ],
  });
  await database.client.caseChecklist.create({
    data: {
      id: OTHER_CHECKLIST_ID,
      organizationId: OTHER_ORGANIZATION_ID,
      caseId: OTHER_CASE_ID,
      templateId: TEMPLATE_ID,
      templateVersion: 1,
      status: 'NEEDS_REVIEW',
    },
  });
  await database.client.caseChecklistItem.create({
    data: {
      id: OTHER_CHECKLIST_ITEM_ID,
      organizationId: OTHER_ORGANIZATION_ID,
      caseId: OTHER_CASE_ID,
      caseChecklistId: OTHER_CHECKLIST_ID,
      templateItemId: templateItem.id,
      titleSnapshot: templateItem.title,
      descriptionSnapshot: templateItem.description,
      isRequiredSnapshot: templateItem.isRequired,
      status: 'MISSING',
    },
  });

  adminToken = await login(ADMIN_EMAIL);
  internToken = await login(INTERN_EMAIL);
});

after(async () => {
  await cleanup();
  await app?.close();
});

describe('Delivery 8 timeline, checklist and task review', () => {
  it('publishes the Delivery 8 HTTP contract', async () => {
    const response = await request(http).get('/api/v1/docs/openapi.json').expect(200);
    assert.ok(response.body.paths['/api/v1/cases/{id}/timeline-events']?.get);
    assert.ok(response.body.paths['/api/v1/timeline-events/{id}/confirm']?.post);
    assert.ok(response.body.paths['/api/v1/cases/{id}/checklist-templates']?.get);
    assert.ok(response.body.paths['/api/v1/cases/{id}/checklists']?.get);
    assert.ok(response.body.paths['/api/v1/cases/{id}/checklists']?.post);
    assert.ok(response.body.paths['/api/v1/checklist-items/{id}']?.patch);
    assert.ok(response.body.paths['/api/v1/checklist-items/{id}/tasks']?.post);
    assert.ok(response.body.paths['/api/v1/cases/{id}/tasks']?.get);
    assert.ok(response.body.paths['/api/v1/tasks/{id}']?.patch);
  });

  it('returns a sourced, unconfirmed event and confirms it without mutating its extraction', async () => {
    const beforeExtraction = await database.client.documentExtraction.findUnique({
      where: { id: STANDARD_EXTRACTION_ID },
    });
    const list = await authorized(
      internToken,
      'get',
      `/api/v1/cases/${DEMO_CASE_ID}/timeline-events`,
    ).expect(200);
    assert.equal(list.body.data.length, 1);
    assert.equal(list.body.data[0].confirmedByUser, false);
    assert.equal(list.body.data[0].sourceId, STANDARD_DOCUMENT_ID);
    assert.deepEqual(list.body.data[0].sourceLocator, {
      pageNumber: 1,
      startOffset: 47,
      endOffset: 57,
    });
    assert.equal(list.body.data[0].extraction.id, STANDARD_EXTRACTION_ID);

    await authorized(
      internToken,
      'post',
      `/api/v1/timeline-events/${STANDARD_EVENT_ID}/confirm`,
    ).expect(403);
    const confirmed = await authorized(
      adminToken,
      'post',
      `/api/v1/timeline-events/${STANDARD_EVENT_ID}/confirm`,
    ).expect(200);
    assert.equal(confirmed.body.confirmedByUser, true);
    assert.equal(confirmed.body.confirmedById, ADMIN_USER_ID);
    assert.ok(confirmed.body.confirmedAt);
    await authorized(
      adminToken,
      'post',
      `/api/v1/timeline-events/${STANDARD_EVENT_ID}/confirm`,
    ).expect(409);
    const afterExtraction = await database.client.documentExtraction.findUnique({
      where: { id: STANDARD_EXTRACTION_ID },
    });
    assert.deepEqual(afterExtraction, beforeExtraction);
  });

  it('applies a versioned snapshot that survives template deactivation', async () => {
    const templates = await authorized(
      internToken,
      'get',
      `/api/v1/cases/${DEMO_CASE_ID}/checklist-templates`,
    ).expect(200);
    assert.equal(templates.body.length, 1);
    assert.equal(templates.body[0].version, 1);
    assert.equal(templates.body[0].items.length, 3);
    await authorized(adminToken, 'post', `/api/v1/cases/${DEMO_CASE_ID}/checklists`)
      .send({ templateId: TEMPLATE_ID })
      .expect(201)
      .then((response) => {
        assert.equal(response.body.templateVersion, 1);
        assert.equal(response.body.items.length, 3);
      });
    await authorized(internToken, 'post', `/api/v1/cases/${DEMO_CASE_ID}/checklists`)
      .send({ templateId: TEMPLATE_ID })
      .expect(403);

    await database.client.checklistTemplate.update({
      where: { id: TEMPLATE_ID },
      data: { isActive: false },
    });
    const persisted = await authorized(
      internToken,
      'get',
      `/api/v1/cases/${DEMO_CASE_ID}/checklists`,
    ).expect(200);
    assert.equal(persisted.body[0].items.length, 3);
    assert.equal(persisted.body[0].items[0].title, 'Documento de identificação');
    await database.client.checklistTemplate.update({
      where: { id: TEMPLATE_ID },
      data: { isActive: true },
    });
  });

  it('reviews items, rejects a document from another case, and creates one traceable task', async () => {
    const checklists = await authorized(
      adminToken,
      'get',
      `/api/v1/cases/${DEMO_CASE_ID}/checklists`,
    ).expect(200);
    const [taskableItem, reviewItem] = checklists.body[0].items;

    await authorized(adminToken, 'patch', `/api/v1/checklist-items/${reviewItem.id}`)
      .send({ status: 'AWAITING_VALIDATION', documentId: AUXILIARY_DOCUMENT_ID })
      .expect(400);
    await authorized(internToken, 'patch', `/api/v1/checklist-items/${reviewItem.id}`)
      .send({ status: 'AWAITING_VALIDATION', documentId: STANDARD_DOCUMENT_ID })
      .expect(403);
    const awaiting = await authorized(
      adminToken,
      'patch',
      `/api/v1/checklist-items/${reviewItem.id}`,
    )
      .send({
        status: 'AWAITING_VALIDATION',
        documentId: STANDARD_DOCUMENT_ID,
        notes: 'Observação sigilosa fictícia D8',
      })
      .expect(200);
    assert.equal(awaiting.body.documentId, STANDARD_DOCUMENT_ID);
    const validated = await authorized(
      adminToken,
      'patch',
      `/api/v1/checklist-items/${reviewItem.id}`,
    )
      .send({ status: 'VALIDATED' })
      .expect(200);
    assert.equal(validated.body.validatedById, ADMIN_USER_ID);
    assert.ok(validated.body.validatedAt);

    await authorized(internToken, 'post', `/api/v1/checklist-items/${taskableItem.id}/tasks`)
      .send({})
      .expect(403);
    const task = await authorized(
      adminToken,
      'post',
      `/api/v1/checklist-items/${taskableItem.id}/tasks`,
    )
      .send({ priority: 'HIGH', assignedToId: ADMIN_USER_ID })
      .expect(201);
    taskId = task.body.id;
    assert.equal(task.body.sourceType, 'AI_CHECKLIST');
    assert.equal(task.body.sourceId, taskableItem.id);
    assert.equal(task.body.caseId, DEMO_CASE_ID);
    await authorized(adminToken, 'post', `/api/v1/checklist-items/${taskableItem.id}/tasks`)
      .send({})
      .expect(409);
    const tasks = await authorized(
      internToken,
      'get',
      `/api/v1/cases/${DEMO_CASE_ID}/tasks`,
    ).expect(200);
    assert.equal(
      tasks.body.data.some((item) => item.id === taskId),
      true,
    );
  });

  it('hides cross-tenant case, event, checklist item, and task paths', async () => {
    await authorized(adminToken, 'get', `/api/v1/cases/${OTHER_CASE_ID}/timeline-events`).expect(
      404,
    );
    await authorized(
      adminToken,
      'get',
      `/api/v1/cases/${OTHER_CASE_ID}/checklist-templates`,
    ).expect(404);
    await authorized(adminToken, 'get', `/api/v1/cases/${OTHER_CASE_ID}/checklists`).expect(404);
    await authorized(adminToken, 'post', `/api/v1/cases/${OTHER_CASE_ID}/checklists`)
      .send({ templateId: TEMPLATE_ID })
      .expect(404);
    await authorized(
      adminToken,
      'post',
      `/api/v1/timeline-events/${OTHER_EVENT_ID}/confirm`,
    ).expect(404);
    await authorized(adminToken, 'patch', `/api/v1/checklist-items/${OTHER_CHECKLIST_ITEM_ID}`)
      .send({ status: 'NOT_APPLICABLE' })
      .expect(404);
    await authorized(adminToken, 'post', `/api/v1/checklist-items/${OTHER_CHECKLIST_ITEM_ID}/tasks`)
      .send({})
      .expect(404);
    await authorized(adminToken, 'get', `/api/v1/cases/${OTHER_CASE_ID}/tasks`).expect(404);
    await authorized(adminToken, 'patch', `/api/v1/tasks/${OTHER_TASK_ID}`)
      .send({ status: 'COMPLETED' })
      .expect(404);

    await authorized(
      internToken,
      'get',
      `/api/v1/cases/${CONFIDENTIAL_CASE_ID}/timeline-events`,
    ).expect(404);
    await authorized(internToken, 'get', `/api/v1/cases/${CONFIDENTIAL_CASE_ID}/checklists`).expect(
      404,
    );
    await authorized(internToken, 'get', `/api/v1/cases/${CONFIDENTIAL_CASE_ID}/tasks`).expect(404);
    await authorized(
      adminToken,
      'get',
      `/api/v1/cases/${CONFIDENTIAL_CASE_ID}/timeline-events`,
    ).expect(200);

    await authorized(adminToken, 'get', `/api/v1/cases/${DELETED_CASE_ID}/timeline-events`).expect(
      404,
    );
    await authorized(adminToken, 'get', `/api/v1/cases/${DELETED_CASE_ID}/checklists`).expect(404);
    await authorized(adminToken, 'get', `/api/v1/cases/${DELETED_CASE_ID}/tasks`).expect(404);
  });

  it('updates task lifecycle fields safely and permits only one concurrent completion', async () => {
    await authorized(internToken, 'patch', `/api/v1/tasks/${taskId}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(403);
    await authorized(adminToken, 'patch', `/api/v1/tasks/${taskId}`).send({}).expect(400);
    const invalidAssignee = await authorized(adminToken, 'patch', `/api/v1/tasks/${taskId}`)
      .send({ assignedToId: OTHER_USER_ID })
      .expect(400);
    assert.equal(invalidAssignee.body.code, 'INVALID_TASK_ASSIGNEE');

    const inProgress = await authorized(adminToken, 'patch', `/api/v1/tasks/${taskId}`)
      .send({
        status: 'IN_PROGRESS',
        priority: 'URGENT',
        assignedToId: INTERN_USER_ID,
        dueAt: '2026-08-20T23:59:59.000Z',
      })
      .expect(200);
    assert.equal(inProgress.body.status, 'IN_PROGRESS');
    assert.equal(inProgress.body.priority, 'URGENT');
    assert.equal(inProgress.body.assignedToId, INTERN_USER_ID);
    assert.equal(inProgress.body.dueAt, '2026-08-20T23:59:59.000Z');
    assert.equal(inProgress.body.completedAt, null);

    const completionResponses = await Promise.all([
      authorized(adminToken, 'patch', `/api/v1/tasks/${taskId}`).send({ status: 'COMPLETED' }),
      authorized(adminToken, 'patch', `/api/v1/tasks/${taskId}`).send({ status: 'COMPLETED' }),
    ]);
    assert.deepEqual(completionResponses.map((response) => response.status).sort(), [200, 409]);
    const completed = completionResponses.find((response) => response.status === 200);
    assert.ok(completed?.body.completedAt);

    const reopened = await authorized(adminToken, 'patch', `/api/v1/tasks/${taskId}`)
      .send({ status: 'OPEN', dueAt: null, assignedToId: null })
      .expect(200);
    assert.equal(reopened.body.status, 'OPEN');
    assert.equal(reopened.body.completedAt, null);
    assert.equal(reopened.body.dueAt, null);
    assert.equal(reopened.body.assignedToId, null);
  });

  it('keeps user-facing legal text out of the safe audit snapshots', async () => {
    assert.ok(taskId);
    const fixtureChecklists = await database.client.caseChecklist.findMany({
      where: { caseId: DEMO_CASE_ID },
      select: { id: true, items: { select: { id: true } } },
    });
    const fixtureEntityIds = [
      STANDARD_EVENT_ID,
      taskId,
      ...fixtureChecklists.map((checklist) => checklist.id),
      ...fixtureChecklists.flatMap((checklist) => checklist.items.map((item) => item.id)),
    ];
    const audits = await database.client.auditLog.findMany({
      where: {
        organizationId: ORGANIZATION_ID,
        entityId: { in: fixtureEntityIds },
        action: {
          in: [
            'timeline.event.confirmed',
            'checklist.applied',
            'checklist_item.updated',
            'task.created',
            'task.updated',
          ],
        },
      },
      select: { actorType: true, newData: true, oldData: true },
    });
    assert.ok(audits.length >= 4);
    assert.equal(
      audits.every((entry) => entry.actorType === 'USER'),
      true,
    );
    const serialized = JSON.stringify(audits);
    assert.equal(serialized.includes('Celebração do contrato fictício'), false);
    assert.equal(serialized.includes('Observação sigilosa fictícia D8'), false);
    assert.equal(serialized.includes('Providenciar:'), false);
  });
});
