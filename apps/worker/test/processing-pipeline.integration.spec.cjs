const { createHash, randomUUID } = require('node:crypto');
const { resolve } = require('node:path');

jest.setTimeout(40_000);

const queuePrefix = 'lex-os-d8-worker-integration';
const organizationId = '00000000-0000-4000-8000-000000000001';
const userId = '00000000-0000-4000-8000-000000000002';
const caseId = '00000000-0000-4000-8000-000000000003';
const checklistTemplateId = '00000000-0000-4000-8000-000000000401';

process.loadEnvFile(resolve(__dirname, '../../../.env'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_HOST = '127.0.0.1';
process.env.DATABASE_PORT = '5433';
process.env.REDIS_HOST = '127.0.0.1';
process.env.PROCESSING_QUEUE_PREFIX = queuePrefix;
process.env.PROCESSING_STALE_AFTER_SECONDS = '86400';
process.env.PROCESSING_RECONCILE_INTERVAL_SECONDS = '3600';
process.env.PROCESSING_JOB_BACKOFF_MS = '100';

let app;
let database;
let publisher;
let processor;
let reconciler;
let repository;
let Queue;
let processingQueueNames;
let otherDocumentTypeId;
const documentIds = [];
const fileIds = [];
const extraCaseIds = [];

function checksum(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function waitFor(load, predicate, description, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await load();
    const failedJob = Array.isArray(value)
      ? value.find((item) => item?.status === 'FAILED')
      : undefined;
    if (failedJob !== undefined) {
      throw new Error(
        `Processing failed while waiting for ${description}: ${failedJob.jobType} ${failedJob.errorCode}.`,
      );
    }
    if (value?.processingStatus === 'FAILED') {
      throw new Error(`Document processing failed while waiting for ${description}.`);
    }
    if (predicate(value)) {
      return value;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
  }
  throw new Error(`Timed out waiting for ${description}.`);
}

async function createFixture(
  jobType,
  inputMetadata = {},
  quarantined = false,
  fixtureCaseId = caseId,
) {
  const fileId = randomUUID();
  const documentId = randomUUID();
  const processingJobId = randomUUID();
  fileIds.push(fileId);
  documentIds.push(documentId);

  await database.client.storedFile.create({
    data: {
      id: fileId,
      organizationId,
      storageProvider: 'integration-test',
      storageBucket: 'integration-test',
      storageKey: `delivery-8/${fileId}`,
      originalFilename: 'documento-ficticio.txt',
      mimeType: 'text/plain',
      extension: 'txt',
      sizeBytes: 128,
      checksumSha256: checksum(fileId),
      uploadedById: userId,
      uploadSource: 'INTEGRATION_TEST',
      virusScanStatus: quarantined ? 'ERROR' : 'CLEAN',
      status: quarantined ? 'QUARANTINED' : 'AVAILABLE',
    },
  });
  await database.client.document.create({
    data: {
      id: documentId,
      organizationId,
      caseId: fixtureCaseId,
      fileId,
      title: 'Documento fictício da Entrega 8',
      processingStatus: 'QUEUED',
      ...(jobType === 'CHECKLIST_ANALYSIS' ? { documentTypeId: otherDocumentTypeId } : {}),
    },
  });
  if (
    ['ENTITY_EXTRACTION', 'TIMELINE_GENERATION', 'CHECKLIST_ANALYSIS', 'EMBEDDING'].includes(
      jobType,
    )
  ) {
    await database.client.documentExtraction.create({
      data: {
        organizationId,
        documentId,
        extractionType: 'OCR',
        provider: 'integration-fixture',
        modelName: 'deterministic-v1',
        modelVersion: '1',
        executionId: `fixture:${processingJobId}`,
        status: 'COMPLETED',
        rawText:
          'Contrato fictício LEX-2026-0001, celebrado em 05/08/2026. Conteúdo exclusivo para desenvolvimento.',
        processingTimeMs: 1,
      },
    });
  }
  await database.client.processingJob.create({
    data: {
      id: processingJobId,
      organizationId,
      caseId: fixtureCaseId,
      fileId,
      documentId,
      jobType,
      status: 'QUEUED',
      inputMetadata,
    },
  });
  return { fileId, documentId, processingJobId };
}

beforeAll(async () => {
  const { NestFactory } = await import('@nestjs/core');
  ({ Queue } = await import('bullmq'));
  ({ processingQueueNames } = await import('@lex-os/contracts'));
  const { AppModule } = await import('../dist/app.module.js');
  const { DatabaseService } = await import('../dist/database/database.service.js');
  const { PipelineProcessorService } =
    await import('../dist/processing/pipeline-processor.service.js');
  const { ProcessingQueuePublisher } =
    await import('../dist/processing/processing-queue.publisher.js');
  const { ProcessingReconcilerService } =
    await import('../dist/processing/processing-reconciler.service.js');
  const { ProcessingRepository } = await import('../dist/processing/processing.repository.js');

  app = await NestFactory.createApplicationContext(AppModule, {
    abortOnError: false,
    logger: ['error'],
  });
  database = app.get(DatabaseService);
  publisher = app.get(ProcessingQueuePublisher);
  processor = app.get(PipelineProcessorService);
  reconciler = app.get(ProcessingReconcilerService);
  repository = app.get(ProcessingRepository);

  const seed = await database.client.case.findFirst({
    where: { id: caseId, organizationId, deletedAt: null },
    select: { id: true },
  });
  if (seed === null) {
    throw new Error('The fictional development seed is required for this integration test.');
  }
  const otherDocumentType = await database.client.documentType.findFirst({
    where: { code: 'OUTRO', organizationId: null },
    select: { id: true },
  });
  if (otherDocumentType === null) {
    throw new Error('The fictional document-type seed is required for this integration test.');
  }
  otherDocumentTypeId = otherDocumentType.id;
});

afterAll(async () => {
  if (database !== undefined && documentIds.length > 0) {
    await database.client.auditLog.deleteMany({
      where: { processingJob: { documentId: { in: documentIds } } },
    });
    await database.client.extractedEntity.deleteMany({
      where: { documentId: { in: documentIds } },
    });
    await database.client.timelineEvent.deleteMany({
      where: { sourceId: { in: documentIds } },
    });
    const checklists = await database.client.caseChecklist.findMany({
      where: { organizationId, caseId, templateId: checklistTemplateId },
      select: { id: true },
    });
    await database.client.caseChecklistItem.deleteMany({
      where: { caseChecklistId: { in: checklists.map((item) => item.id) } },
    });
    await database.client.caseChecklist.deleteMany({
      where: { id: { in: checklists.map((item) => item.id) } },
    });
    await database.client.knowledgeChunk.deleteMany({
      where: { documentId: { in: documentIds } },
    });
    await database.client.documentExtraction.deleteMany({
      where: { documentId: { in: documentIds } },
    });
    await database.client.processingJob.deleteMany({ where: { documentId: { in: documentIds } } });
    await database.client.document.deleteMany({ where: { id: { in: documentIds } } });
    await database.client.storedFile.deleteMany({ where: { id: { in: fileIds } } });
    if (extraCaseIds.length > 0) {
      await database.client.case.deleteMany({ where: { id: { in: extraCaseIds } } });
    }
  }
  if (app !== undefined) {
    await app.close();
  }
  if (Queue !== undefined && processingQueueNames !== undefined) {
    const queues = [...new Set(Object.values(processingQueueNames))].map(
      (name) =>
        new Queue(name, {
          prefix: queuePrefix,
          connection: {
            host: process.env.REDIS_HOST,
            port: Number(process.env.REDIS_PORT),
            password: process.env.REDIS_PASSWORD,
            maxRetriesPerRequest: 1,
          },
        }),
    );
    await Promise.all(queues.map((queue) => queue.obliterate({ force: true })));
    await Promise.all(queues.map((queue) => queue.close()));
  }
});

describe('Delivery 8 persistent processing pipeline', () => {
  it('acknowledges orphaned deliveries without retrying stale queue data', async () => {
    const orphaned = await processor.process(
      {
        schemaVersion: 1,
        processingJobId: randomUUID(),
        organizationId,
        correlationId: randomUUID(),
      },
      'FILE_VALIDATION',
      1,
      3,
    );
    expect(orphaned).toEqual({ skipped: true });
  });

  it('resumes a persisted PROCESSING claim after a BullMQ stalled redelivery', async () => {
    const fixture = await createFixture('ENTITY_EXTRACTION');
    await database.client.processingJob.update({
      where: { id: fixture.processingJobId },
      data: { status: 'PROCESSING', attempts: 1, version: 1, startedAt: new Date() },
    });

    const resumed = await processor.process(
      {
        schemaVersion: 1,
        processingJobId: fixture.processingJobId,
        organizationId,
        correlationId: randomUUID(),
      },
      'ENTITY_EXTRACTION',
      2,
      3,
    );
    expect(resumed).toEqual({ skipped: false });
    await expect(
      database.client.processingJob.findUnique({ where: { id: fixture.processingJobId } }),
    ).resolves.toMatchObject({ status: 'COMPLETED', attempts: 2, version: 3 });
  });

  it('conclui a análise de checklist sem exigências quando o tipo de caso não tem template', async () => {
    const caseWithoutTemplateId = randomUUID();
    extraCaseIds.push(caseWithoutTemplateId);
    await database.client.case.create({
      data: {
        id: caseWithoutTemplateId,
        organizationId,
        internalCode: `NO-TPL-${caseWithoutTemplateId.slice(0, 8)}`,
        title: 'Caso fictício sem template de checklist',
        description: 'Fixture da Entrega 11: tipo de caso sem checklist ativo.',
        legalArea: 'CIVEL',
        caseType: 'ACAO_DE_COBRANCA',
        status: 'INTAKE',
      },
    });
    const fixture = await createFixture('CHECKLIST_ANALYSIS', {}, false, caseWithoutTemplateId);

    const result = await processor.process(
      {
        schemaVersion: 1,
        processingJobId: fixture.processingJobId,
        organizationId,
        correlationId: randomUUID(),
      },
      'CHECKLIST_ANALYSIS',
      1,
      3,
    );
    expect(result).toEqual({ skipped: false });

    const job = await database.client.processingJob.findUnique({
      where: { id: fixture.processingJobId },
    });
    expect(job).toMatchObject({ status: 'COMPLETED', errorCode: null });
    expect(job.outputMetadata).toMatchObject({ itemCount: 0, templateAvailable: false });

    // Sem template não nasce checklist nem extração: a procedência permanece fiel ao que
    // realmente aconteceu — nenhum provedor analisou exigências.
    await expect(
      database.client.caseChecklist.findMany({ where: { caseId: caseWithoutTemplateId } }),
    ).resolves.toHaveLength(0);
    await expect(
      database.client.documentExtraction.findMany({
        where: { documentId: fixture.documentId, extractionType: 'CHECKLIST_ANALYSIS' },
      }),
    ).resolves.toHaveLength(0);

    // O pipeline segue adiante: a indexação nasce e o documento continua pesquisável.
    await expect(
      database.client.processingJob.findMany({
        where: { documentId: fixture.documentId, jobType: 'EMBEDDING' },
      }),
    ).resolves.toHaveLength(1);
  });

  it('persists every successful stage, provenance, entities and human-review state', async () => {
    const fixture = await createFixture('FILE_VALIDATION');
    await publisher.publish('FILE_VALIDATION', {
      schemaVersion: 1,
      processingJobId: fixture.processingJobId,
      organizationId,
      correlationId: randomUUID(),
    });

    const jobs = await waitFor(
      () =>
        database.client.processingJob.findMany({
          where: { documentId: fixture.documentId },
          orderBy: { createdAt: 'asc' },
        }),
      (rows) => rows.length === 7 && rows.every((job) => job.status === 'COMPLETED'),
      'the seven-stage pipeline',
    );
    expect(jobs.map((job) => job.jobType)).toEqual([
      'FILE_VALIDATION',
      'OCR',
      'DOCUMENT_CLASSIFICATION',
      'ENTITY_EXTRACTION',
      'TIMELINE_GENERATION',
      'CHECKLIST_ANALYSIS',
      'EMBEDDING',
    ]);
    expect(jobs.every((job) => job.attempts === 1 && job.finishedAt !== null)).toBe(true);
    expect(
      jobs.every(
        (job) =>
          job.provider !== null &&
          job.modelName !== null &&
          job.modelVersion === '1' &&
          job.costAmount?.toFixed(6) === '0.000000' &&
          job.reservedCostAmount.toFixed(6) === '0.000000' &&
          job.costCurrency === 'BRL',
      ),
    ).toBe(true);

    const extractions = await database.client.documentExtraction.findMany({
      where: { documentId: fixture.documentId },
      include: { extractedEntities: true },
    });
    expect(extractions).toHaveLength(5);
    expect(extractions.map((item) => item.extractionType).sort()).toEqual([
      'CHECKLIST_ANALYSIS',
      'CLASSIFICATION',
      'ENTITY_EXTRACTION',
      'OCR',
      'TIMELINE_ANALYSIS',
    ]);
    expect(extractions.every((item) => item.provider.startsWith('lex-os-mock'))).toBe(true);
    expect(
      extractions.find((item) => item.extractionType === 'ENTITY_EXTRACTION').extractedEntities,
    ).toHaveLength(2);

    const timeline = await database.client.timelineEvent.findMany({
      where: { organizationId, caseId, sourceId: fixture.documentId },
    });
    expect(timeline).toHaveLength(1);
    expect(timeline[0]).toMatchObject({
      sourceType: 'DOCUMENT',
      createdByActorType: 'AI',
      confirmedByUser: false,
      confirmedById: null,
    });
    expect(timeline[0].extractionId).not.toBeNull();

    const checklist = await database.client.caseChecklist.findFirst({
      where: { organizationId, caseId, templateId: checklistTemplateId },
      include: { items: true },
    });
    expect(checklist).not.toBeNull();
    expect(checklist.templateVersion).toBe(1);
    expect(checklist.items).toHaveLength(3);
    expect(checklist.items.some((item) => item.status === 'AWAITING_VALIDATION')).toBe(true);

    const chunks = await database.client.knowledgeChunk.findMany({
      where: { organizationId, caseId, documentId: fixture.documentId },
      select: {
        id: true,
        sourceType: true,
        sourceId: true,
        chunkIndex: true,
        content: true,
        contentHash: true,
        embeddingProvider: true,
        embeddingModel: true,
        embeddingVersion: true,
        embeddingDimensions: true,
        metadata: true,
      },
    });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      sourceType: 'DOCUMENT_EXTRACTION',
      chunkIndex: 0,
      embeddingProvider: 'lex-os-mock-embedding',
      embeddingModel: 'deterministic-hash-v1',
      embeddingVersion: '1',
      embeddingDimensions: 16,
    });
    expect(chunks[0].contentHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(chunks[0].metadata.locator).toMatchObject({
      pageNumber: 1,
      startOffset: 0,
      endOffset: chunks[0].content.length,
    });
    expect(chunks[0].metadata.sourceExtractionId).toBe(chunks[0].sourceId);
    await expect(
      database.client.auditLog.count({
        where: {
          processingJob: { documentId: fixture.documentId },
          action: 'knowledge.document.indexed',
          actorType: 'AI',
        },
      }),
    ).resolves.toBe(1);

    const document = await database.client.document.findUnique({
      where: { id: fixture.documentId },
    });
    expect(document.processingStatus).toBe('NEEDS_REVIEW');
    expect(document.classificationStatus).toBe('NEEDS_REVIEW');

    const beforeDuplicate = await database.client.documentExtraction.count({
      where: { documentId: fixture.documentId },
    });
    const chunksBeforeDuplicate = await database.client.knowledgeChunk.count({
      where: { documentId: fixture.documentId },
    });
    const duplicate = await processor.process(
      {
        schemaVersion: 1,
        processingJobId: fixture.processingJobId,
        organizationId,
        correlationId: randomUUID(),
      },
      'FILE_VALIDATION',
      1,
      3,
    );
    expect(duplicate).toEqual({ skipped: true, status: 'COMPLETED' });
    await expect(
      database.client.documentExtraction.count({ where: { documentId: fixture.documentId } }),
    ).resolves.toBe(beforeDuplicate);
    await expect(
      database.client.knowledgeChunk.count({ where: { documentId: fixture.documentId } }),
    ).resolves.toBe(chunksBeforeDuplicate);
  });

  it('records a transient retry and then completes exactly once', async () => {
    const fixture = await createFixture('OCR', { mockFailureMode: 'RETRY_ONCE' });
    await publisher.publish('OCR', {
      schemaVersion: 1,
      processingJobId: fixture.processingJobId,
      organizationId,
      correlationId: randomUUID(),
    });

    const root = await waitFor(
      () => database.client.processingJob.findUnique({ where: { id: fixture.processingJobId } }),
      (job) => job?.status === 'COMPLETED',
      'the retried OCR job',
    );
    expect(root.attempts).toBe(2);
    expect(root.errorCode).toBeNull();
    await waitFor(
      () => database.client.document.findUnique({ where: { id: fixture.documentId } }),
      (document) => document?.processingStatus === 'NEEDS_REVIEW',
      'the descendants of the retried job',
    );
    await expect(
      database.client.documentExtraction.count({
        where: { documentId: fixture.documentId, extractionType: 'OCR' },
      }),
    ).resolves.toBe(1);
    await expect(
      database.client.auditLog.count({
        where: {
          processingJobId: fixture.processingJobId,
          action: 'processing.job.retrying',
        },
      }),
    ).resolves.toBe(1);
  });

  it('fails closed after bounded virus-scan attempts and never releases quarantine', async () => {
    const fixture = await createFixture('VIRUS_SCAN', {}, true);
    await publisher.publish('VIRUS_SCAN', {
      schemaVersion: 1,
      processingJobId: fixture.processingJobId,
      organizationId,
      correlationId: randomUUID(),
    });

    const failed = await waitFor(
      () => database.client.processingJob.findUnique({ where: { id: fixture.processingJobId } }),
      (job) => job?.status === 'FAILED',
      'the terminal virus-scan failure',
    );
    expect(failed.attempts).toBe(3);
    expect(failed.errorCode).toBe('SCANNER_UNAVAILABLE');
    const file = await database.client.storedFile.findUnique({ where: { id: fixture.fileId } });
    expect(file.status).toBe('QUARANTINED');
    expect(file.virusScanStatus).toBe('ERROR');
  });

  it('republishes a stale persistent job that is missing from Redis', async () => {
    const fixture = await createFixture('OCR');
    await database.client.processingJob.update({
      where: { id: fixture.processingJobId },
      data: { updatedAt: new Date(Date.now() - 90_000_000) },
    });

    await expect(reconciler.reconcileOnce()).resolves.toBeGreaterThanOrEqual(1);
    await waitFor(
      () => database.client.document.findUnique({ where: { id: fixture.documentId } }),
      (document) => document?.processingStatus === 'NEEDS_REVIEW',
      'the reconciled pipeline',
    );
    await expect(
      database.client.processingJob.findUnique({ where: { id: fixture.processingJobId } }),
    ).resolves.toMatchObject({ status: 'COMPLETED', attempts: 1 });
  });

  it('persists cancellation through the same guarded state machine', async () => {
    const fixture = await createFixture('OCR');
    await expect(
      repository.cancel(organizationId, fixture.processingJobId, randomUUID()),
    ).resolves.toBe(true);
    await expect(
      database.client.processingJob.findUnique({ where: { id: fixture.processingJobId } }),
    ).resolves.toMatchObject({
      status: 'CANCELLED',
      errorCode: null,
      errorMessage: null,
    });
    await expect(
      repository.cancel(organizationId, fixture.processingJobId, randomUUID()),
    ).resolves.toBe(false);
  });

  it('blocks a quoted execution above the case ceiling and releases valid reservations', async () => {
    const originalBudget = await database.client.case.findUniqueOrThrow({
      where: { id: caseId },
      select: {
        processingCostLimitAmount: true,
        processingCostSpentAmount: true,
        processingCostReservedAmount: true,
        processingBudgetStatus: true,
        processingLimitReachedAt: true,
      },
    });
    try {
      await database.client.case.update({
        where: { id: caseId },
        data: {
          processingCostLimitAmount: 0,
          processingCostSpentAmount: 0,
          processingCostReservedAmount: 0,
          processingBudgetStatus: 'ACTIVE',
          processingLimitReachedAt: null,
        },
      });
      const blockedFixture = await createFixture('OCR');
      await expect(
        repository.claim(organizationId, blockedFixture.processingJobId, 'OCR', randomUUID(), {
          provider: 'provider-ficticio',
          modelName: 'modelo-ficticio',
          modelVersion: '1',
          maximumAmount: '0.100000',
          currency: 'BRL',
        }),
      ).resolves.toEqual({ disposition: 'BUDGET_LIMIT_REACHED' });
      await expect(
        database.client.processingJob.findUnique({ where: { id: blockedFixture.processingJobId } }),
      ).resolves.toMatchObject({
        status: 'CANCELLED',
        errorCode: null,
        outputMetadata: { stage: 'OCR', reason: 'PROCESSING_COST_LIMIT_REACHED' },
        costAmount: null,
      });
      await expect(
        database.client.document.findUnique({ where: { id: blockedFixture.documentId } }),
      ).resolves.toMatchObject({ processingStatus: 'NEEDS_REVIEW' });
      await expect(
        database.client.case.findUnique({ where: { id: caseId } }),
      ).resolves.toMatchObject({ processingBudgetStatus: 'LIMIT_REACHED' });

      await database.client.case.update({
        where: { id: caseId },
        data: {
          processingCostLimitAmount: 1,
          processingBudgetStatus: 'ACTIVE',
          processingLimitReachedAt: null,
        },
      });
      const reservedFixture = await createFixture('OCR');
      const claimed = await repository.claim(
        organizationId,
        reservedFixture.processingJobId,
        'OCR',
        randomUUID(),
        {
          provider: 'provider-ficticio',
          modelName: 'modelo-ficticio',
          modelVersion: '1',
          maximumAmount: '0.500000',
          currency: 'BRL',
        },
      );
      expect(claimed.disposition).toBe('PROCESS');
      const reservedCase = await database.client.case.findUniqueOrThrow({ where: { id: caseId } });
      expect(reservedCase.processingCostReservedAmount.toFixed(6)).toBe('0.500000');
      await expect(
        repository.cancel(organizationId, reservedFixture.processingJobId, randomUUID()),
      ).resolves.toBe(true);
      const releasedCase = await database.client.case.findUniqueOrThrow({ where: { id: caseId } });
      expect(releasedCase.processingCostReservedAmount.toFixed(6)).toBe('0.000000');
    } finally {
      await database.client.case.update({
        where: { id: caseId },
        data: originalBudget,
      });
    }
  });
});
