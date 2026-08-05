import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type JobType as DatabaseProcessingJobType,
  type JobStatus,
  type TransactionClient,
  withTransaction,
} from '@lex-os/database';
import type { ProcessingJobType } from '@lex-os/contracts';

import { DatabaseService } from '../database/database.service.js';
import { deterministicJobId } from './deterministic-id.js';
import { assertTransition } from './job-state-machine.js';

const jobTargetSelect = {
  id: true,
  organizationId: true,
  caseId: true,
  fileId: true,
  documentId: true,
  jobType: true,
  status: true,
  attempts: true,
  version: true,
  inputMetadata: true,
  document: {
    select: {
      id: true,
      organizationId: true,
      caseId: true,
      fileId: true,
      deletedAt: true,
      file: {
        select: {
          id: true,
          organizationId: true,
          mimeType: true,
          status: true,
          virusScanStatus: true,
          deletedAt: true,
        },
      },
      case: { select: { id: true, organizationId: true, deletedAt: true } },
    },
  },
} satisfies Prisma.ProcessingJobSelect;

type JobTargetRecord = Prisma.ProcessingJobGetPayload<{ select: typeof jobTargetSelect }>;

export interface ClaimedProcessingJob extends JobTargetRecord {
  status: 'PROCESSING';
  jobType: ProcessingJobType;
  caseId: string;
  fileId: string;
  documentId: string;
  document: NonNullable<JobTargetRecord['document']> & {
    case: NonNullable<NonNullable<JobTargetRecord['document']>['case']>;
  };
}

export interface NextProcessingJob {
  id: string;
  organizationId: string;
  jobType: ProcessingJobType;
}

export type ClaimResult =
  | { disposition: 'PROCESS'; job: ClaimedProcessingJob }
  | { disposition: 'SKIP'; status?: JobStatus };

export interface StageCompletion {
  provider: string;
  modelName: string;
  outputMetadata: Prisma.InputJsonObject;
  extraction?: {
    type: 'OCR' | 'CLASSIFICATION' | 'ENTITY_EXTRACTION';
    executionId: string;
    rawText?: string;
    structuredData?: Prisma.InputJsonObject;
    confidenceScore?: number;
    processingTimeMs: number;
    entities?: readonly {
      entityType: string;
      normalizedValue: string;
      originalValue: string;
      pageNumber: number;
      startOffset: number;
      endOffset: number;
      confidenceScore: number;
    }[];
  };
  classification?: { documentTypeCode: 'OUTRO'; confidenceScore: number };
  nextJobType?: ProcessingJobType;
  finalDocumentStatus?: 'NEEDS_REVIEW';
}

function asJson(value: object): Prisma.InputJsonObject {
  return { ...value } as Prisma.InputJsonObject;
}

function assertTenantRelationships(job: JobTargetRecord): asserts job is JobTargetRecord & {
  caseId: string;
  fileId: string;
  documentId: string;
  document: NonNullable<JobTargetRecord['document']> & {
    case: NonNullable<NonNullable<JobTargetRecord['document']>['case']>;
  };
} {
  const document = job.document;
  if (
    job.caseId === null ||
    job.fileId === null ||
    job.documentId === null ||
    document === null ||
    document.case === null ||
    job.organizationId !== document.organizationId ||
    job.organizationId !== document.file.organizationId ||
    job.organizationId !== document.case.organizationId ||
    job.documentId !== document.id ||
    job.fileId !== document.fileId ||
    job.caseId !== document.caseId ||
    document.deletedAt !== null ||
    document.file.deletedAt !== null ||
    document.case.deletedAt !== null
  ) {
    throw new Error('Processing job has inconsistent tenant relationships.');
  }
}

@Injectable()
export class ProcessingRepository {
  constructor(private readonly database: DatabaseService) {}

  async claim(
    organizationId: string,
    processingJobId: string,
    expectedJobType: ProcessingJobType,
    correlationId: string,
  ): Promise<ClaimResult> {
    return withTransaction(this.database.client, async (transaction) => {
      const current = await transaction.processingJob.findFirst({
        where: { id: processingJobId, organizationId },
        select: jobTargetSelect,
      });
      if (current === null) {
        return { disposition: 'SKIP' };
      }
      if (current.jobType !== expectedJobType) {
        throw new Error('Processing job type does not match its queue.');
      }
      if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(current.status)) {
        return { disposition: 'SKIP', status: current.status };
      }
      if (
        current.status !== 'QUEUED' &&
        current.status !== 'RETRYING' &&
        current.status !== 'PROCESSING'
      ) {
        throw new Error(`Processing job cannot be claimed from ${current.status}.`);
      }
      assertTenantRelationships(current);
      if (current.status !== 'PROCESSING') {
        assertTransition(current.status, 'PROCESSING');
      }
      const updated = await transaction.processingJob.updateMany({
        where: {
          id: current.id,
          organizationId,
          status: current.status,
          version: current.version,
        },
        data: {
          status: 'PROCESSING',
          attempts: { increment: 1 },
          version: { increment: 1 },
          ...(current.status === 'QUEUED' ? { startedAt: new Date() } : {}),
          errorCode: null,
          errorMessage: null,
        },
      });
      if (updated.count !== 1) {
        throw new Error('Processing job claim lost an optimistic concurrency race.');
      }
      await transaction.document.updateMany({
        where: { id: current.documentId, organizationId, deletedAt: null },
        data: { processingStatus: 'PROCESSING' },
      });
      await this.#audit(transaction, {
        organizationId,
        processingJobId: current.id,
        actorType: 'SYSTEM',
        action:
          current.status === 'PROCESSING'
            ? 'processing.job.resumed_after_stall'
            : 'processing.job.started',
        entityType: 'processing_job',
        entityId: current.id,
        correlationId,
        data: { jobType: current.jobType, attempt: current.attempts + 1 },
      });
      return {
        disposition: 'PROCESS',
        job: {
          ...current,
          status: 'PROCESSING',
          attempts: current.attempts + 1,
          version: current.version + 1,
          jobType: expectedJobType,
        },
      };
    });
  }

  async complete(
    job: ClaimedProcessingJob,
    completion: StageCompletion,
    correlationId: string,
  ): Promise<NextProcessingJob | null> {
    assertTransition('PROCESSING', 'COMPLETED');
    return withTransaction(this.database.client, async (transaction) => {
      let extractionId: string | undefined;
      if (completion.extraction !== undefined) {
        const extraction = await transaction.documentExtraction.create({
          data: {
            organizationId: job.organizationId,
            documentId: job.documentId,
            extractionType: completion.extraction.type,
            provider: completion.provider,
            modelName: completion.modelName,
            modelVersion: '1',
            executionId: completion.extraction.executionId,
            status: 'COMPLETED',
            ...(completion.extraction.rawText === undefined
              ? {}
              : { rawText: completion.extraction.rawText }),
            ...(completion.extraction.structuredData === undefined
              ? {}
              : { structuredData: completion.extraction.structuredData }),
            ...(completion.extraction.confidenceScore === undefined
              ? {}
              : { confidenceScore: completion.extraction.confidenceScore }),
            processingTimeMs: completion.extraction.processingTimeMs,
            promptVersion: completion.extraction.type === 'OCR' ? null : 'deterministic-prompt-v1',
          },
          select: { id: true },
        });
        extractionId = extraction.id;
        if (
          completion.extraction.type === 'ENTITY_EXTRACTION' &&
          completion.extraction.entities !== undefined
        ) {
          await transaction.extractedEntity.createMany({
            data: completion.extraction.entities.map((entity) => ({
              organizationId: job.organizationId,
              documentId: job.documentId,
              extractionId: extraction.id,
              entityType: entity.entityType,
              normalizedValue: entity.normalizedValue,
              originalValue: entity.originalValue,
              pageNumber: entity.pageNumber,
              startOffset: entity.startOffset,
              endOffset: entity.endOffset,
              confidenceScore: entity.confidenceScore,
              metadata: asJson({ source: 'DETERMINISTIC_MOCK' }),
            })),
          });
        }
        await this.#audit(transaction, {
          organizationId: job.organizationId,
          processingJobId: job.id,
          actorType: 'AI',
          action: 'processing.extraction.created',
          entityType: 'document_extraction',
          entityId: extraction.id,
          correlationId,
          data: {
            extractionType: completion.extraction.type,
            provider: completion.provider,
            modelName: completion.modelName,
          },
        });
      }

      if (completion.classification !== undefined) {
        const documentType = await transaction.documentType.findFirst({
          where: {
            code: completion.classification.documentTypeCode,
            OR: [{ organizationId: null }, { organizationId: job.organizationId }],
          },
          orderBy: [{ organizationId: 'desc' }, { createdAt: 'asc' }],
          select: { id: true },
        });
        if (documentType === null) {
          throw new Error('The OUTRO document type is not configured.');
        }
        await transaction.document.updateMany({
          where: { id: job.documentId, organizationId: job.organizationId, deletedAt: null },
          data: {
            documentTypeId: documentType.id,
            classificationStatus: 'NEEDS_REVIEW',
            confidenceScore: completion.classification.confidenceScore,
          },
        });
      }

      let nextJob: NextProcessingJob | null = null;
      if (completion.nextJobType !== undefined) {
        const id = deterministicJobId(job.id, completion.nextJobType);
        const created = await transaction.processingJob.create({
          data: {
            id,
            organizationId: job.organizationId,
            caseId: job.caseId,
            fileId: job.fileId,
            documentId: job.documentId,
            jobType: completion.nextJobType as DatabaseProcessingJobType,
            status: 'QUEUED',
            inputMetadata: asJson({ parentProcessingJobId: job.id }),
          },
          select: { id: true, organizationId: true, jobType: true },
        });
        nextJob = {
          id: created.id,
          organizationId: created.organizationId,
          jobType: completion.nextJobType,
        };
      }

      if (completion.finalDocumentStatus !== undefined) {
        await transaction.document.updateMany({
          where: { id: job.documentId, organizationId: job.organizationId, deletedAt: null },
          data: { processingStatus: completion.finalDocumentStatus },
        });
      }
      const completed = await transaction.processingJob.updateMany({
        where: {
          id: job.id,
          organizationId: job.organizationId,
          status: 'PROCESSING',
          version: job.version,
        },
        data: {
          status: 'COMPLETED',
          version: { increment: 1 },
          provider: completion.provider,
          modelName: completion.modelName,
          outputMetadata: {
            ...completion.outputMetadata,
            ...(extractionId === undefined ? {} : { extractionId }),
            ...(nextJob === null ? {} : { nextProcessingJobId: nextJob.id }),
          },
          errorCode: null,
          errorMessage: null,
          finishedAt: new Date(),
        },
      });
      if (completed.count !== 1) {
        throw new Error('Processing completion lost an optimistic concurrency race.');
      }
      await this.#audit(transaction, {
        organizationId: job.organizationId,
        processingJobId: job.id,
        actorType: 'SYSTEM',
        action: 'processing.job.completed',
        entityType: 'processing_job',
        entityId: job.id,
        correlationId,
        data: { jobType: job.jobType, nextProcessingJobId: nextJob?.id ?? null },
      });
      return nextJob;
    });
  }

  async retry(
    job: ClaimedProcessingJob,
    errorCode: string,
    errorMessage: string,
    correlationId: string,
  ): Promise<void> {
    await this.#terminalOrRetry(job, 'RETRYING', errorCode, errorMessage, correlationId);
  }

  async fail(
    job: ClaimedProcessingJob,
    errorCode: string,
    errorMessage: string,
    correlationId: string,
  ): Promise<void> {
    await this.#terminalOrRetry(job, 'FAILED', errorCode, errorMessage, correlationId);
  }

  async cancel(
    organizationId: string,
    processingJobId: string,
    correlationId: string,
  ): Promise<boolean> {
    return withTransaction(this.database.client, async (transaction) => {
      const current = await transaction.processingJob.findFirst({
        where: { id: processingJobId, organizationId },
        select: { status: true, version: true },
      });
      if (
        current === null ||
        (current.status !== 'QUEUED' &&
          current.status !== 'RETRYING' &&
          current.status !== 'PROCESSING')
      ) {
        return false;
      }
      assertTransition(current.status, 'CANCELLED');
      const result = await transaction.processingJob.updateMany({
        where: {
          id: processingJobId,
          organizationId,
          status: current.status,
          version: current.version,
        },
        data: {
          status: 'CANCELLED',
          version: { increment: 1 },
          errorCode: null,
          errorMessage: null,
          finishedAt: new Date(),
        },
      });
      if (result.count === 1) {
        await this.#audit(transaction, {
          organizationId,
          processingJobId,
          actorType: 'SYSTEM',
          action: 'processing.job.cancelled',
          entityType: 'processing_job',
          entityId: processingJobId,
          correlationId,
          data: {},
        });
      }
      return result.count === 1;
    });
  }

  staleReconcilable(before: Date, take: number) {
    return this.database.client.processingJob.findMany({
      where: {
        status: { in: ['QUEUED', 'RETRYING'] },
        updatedAt: { lt: before },
        jobType: {
          in: [
            'FILE_VALIDATION',
            'VIRUS_SCAN',
            'OCR',
            'DOCUMENT_CLASSIFICATION',
            'ENTITY_EXTRACTION',
          ],
        },
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take,
      select: { id: true, organizationId: true, jobType: true },
    });
  }

  async #terminalOrRetry(
    job: ClaimedProcessingJob,
    status: 'RETRYING' | 'FAILED',
    errorCode: string,
    errorMessage: string,
    correlationId: string,
  ): Promise<void> {
    assertTransition('PROCESSING', status);
    await withTransaction(this.database.client, async (transaction) => {
      const result = await transaction.processingJob.updateMany({
        where: {
          id: job.id,
          organizationId: job.organizationId,
          status: 'PROCESSING',
          version: job.version,
        },
        data: {
          status,
          version: { increment: 1 },
          errorCode,
          errorMessage,
          finishedAt: status === 'FAILED' ? new Date() : null,
        },
      });
      if (result.count !== 1) {
        throw new Error('Processing error transition lost an optimistic concurrency race.');
      }
      if (status === 'FAILED') {
        await transaction.document.updateMany({
          where: { id: job.documentId, organizationId: job.organizationId, deletedAt: null },
          data: {
            processingStatus: 'FAILED',
            ...(job.jobType === 'DOCUMENT_CLASSIFICATION'
              ? { classificationStatus: 'FAILED' }
              : {}),
          },
        });
      }
      await this.#audit(transaction, {
        organizationId: job.organizationId,
        processingJobId: job.id,
        actorType: 'SYSTEM',
        action: status === 'FAILED' ? 'processing.job.failed' : 'processing.job.retrying',
        entityType: 'processing_job',
        entityId: job.id,
        correlationId,
        data: { jobType: job.jobType, errorCode },
      });
    });
  }

  async #audit(
    transaction: TransactionClient,
    input: {
      organizationId: string;
      processingJobId: string;
      actorType: 'SYSTEM' | 'AI';
      action: string;
      entityType: string;
      entityId: string;
      correlationId: string;
      data: object;
    },
  ): Promise<void> {
    await transaction.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: null,
        actorType: input.actorType,
        actorId: input.actorType === 'AI' ? 'lex-os-mock-provider' : 'lex-os-worker',
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        newData: asJson(input.data),
        requestId: null,
        correlationId: input.correlationId,
        processingJobId: input.processingJobId,
      },
    });
  }
}
