const { createHash, randomUUID } = require('node:crypto');
const { resolve } = require('node:path');

jest.setTimeout(40_000);

const queuePrefix = 'lex-os-d7-worker-integration';
const organizationId = '00000000-0000-4000-8000-000000000001';
const userId = '00000000-0000-4000-8000-000000000002';
const caseId = '00000000-0000-4000-8000-000000000003';

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
const documentIds = [];
const fileIds = [];

function checksum(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function waitFor(load, predicate, description, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await load();
    if (predicate(value)) {
      return value;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
  }
  throw new Error(`Timed out waiting for ${description}.`);
}

async function createFixture(jobType, inputMetadata = {}, quarantined = false) {
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
      storageKey: `delivery-7/${fileId}`,
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
      caseId,
      fileId,
      title: 'Documento fictício da Entrega 7',
      processingStatus: 'QUEUED',
    },
  });
  await database.client.processingJob.create({
    data: {
      id: processingJobId,
      organizationId,
      caseId,
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
});

afterAll(async () => {
  if (database !== undefined && documentIds.length > 0) {
    await database.client.auditLog.deleteMany({
      where: { processingJob: { documentId: { in: documentIds } } },
    });
    await database.client.extractedEntity.deleteMany({
      where: { documentId: { in: documentIds } },
    });
    await database.client.documentExtraction.deleteMany({
      where: { documentId: { in: documentIds } },
    });
    await database.client.processingJob.deleteMany({ where: { documentId: { in: documentIds } } });
    await database.client.document.deleteMany({ where: { id: { in: documentIds } } });
    await database.client.storedFile.deleteMany({ where: { id: { in: fileIds } } });
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

describe('Delivery 7 persistent processing pipeline', () => {
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
      (rows) => rows.length === 4 && rows.every((job) => job.status === 'COMPLETED'),
      'the four-stage pipeline',
    );
    expect(jobs.map((job) => job.jobType)).toEqual([
      'FILE_VALIDATION',
      'OCR',
      'DOCUMENT_CLASSIFICATION',
      'ENTITY_EXTRACTION',
    ]);
    expect(jobs.every((job) => job.attempts === 1 && job.finishedAt !== null)).toBe(true);

    const extractions = await database.client.documentExtraction.findMany({
      where: { documentId: fixture.documentId },
      include: { extractedEntities: true },
    });
    expect(extractions).toHaveLength(3);
    expect(extractions.map((item) => item.extractionType).sort()).toEqual([
      'CLASSIFICATION',
      'ENTITY_EXTRACTION',
      'OCR',
    ]);
    expect(extractions.every((item) => item.provider.startsWith('lex-os-mock'))).toBe(true);
    expect(
      extractions.find((item) => item.extractionType === 'ENTITY_EXTRACTION').extractedEntities,
    ).toHaveLength(2);

    const document = await database.client.document.findUnique({
      where: { id: fixture.documentId },
    });
    expect(document.processingStatus).toBe('NEEDS_REVIEW');
    expect(document.classificationStatus).toBe('NEEDS_REVIEW');

    const beforeDuplicate = await database.client.documentExtraction.count({
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
});
