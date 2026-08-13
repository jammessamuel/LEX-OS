import { randomUUID } from 'node:crypto';

import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { withTransaction } from '@lex-os/database';

import { AuditService, type RequestAuditMetadata } from '../audit/audit.service.js';
import type { ActorContext } from '../auth/actor-context.js';
import { CasesService } from '../cases/cases.service.js';
import { DatabaseService } from '../database/database.service.js';
import { DocumentsService } from '../documents/documents.service.js';
import { ApiException } from '../http/api-exception.js';
import {
  createTimestampIdCursorParser,
  decodeCursor,
  encodeCursor,
  type CursorPage,
} from '../http/pagination.js';
import { MetricsService } from '../observability/metrics.service.js';
import type { ListProcessingJobsQueryDto } from './dto/list-processing-jobs-query.dto.js';
import type { ProcessingJobResponseDto } from './dto/processing-job-response.dto.js';
import { ProcessingQueuePublisher } from './processing-queue.publisher.js';
import {
  ProcessingRepository,
  type ProcessingJobCursor,
  type ProcessingJobRecord,
} from './processing.repository.js';

const parseCursor: (value: unknown) => ProcessingJobCursor | undefined =
  createTimestampIdCursorParser('createdAt');

function mapJob(record: ProcessingJobRecord): ProcessingJobResponseDto {
  return {
    id: record.id,
    caseId: record.caseId,
    fileId: record.fileId,
    documentId: record.documentId,
    jobType: record.jobType,
    status: record.status,
    priority: record.priority,
    attempts: record.attempts,
    version: record.version,
    provider: record.provider,
    modelName: record.modelName,
    modelVersion: record.modelVersion,
    reservedCostAmount: record.reservedCostAmount.toFixed(6),
    costAmount: record.costAmount?.toFixed(6) ?? null,
    costCurrency: record.costCurrency,
    outputMetadata: record.outputMetadata,
    errorCode: record.errorCode,
    errorMessage: record.errorMessage,
    startedAt: record.startedAt?.toISOString() ?? null,
    finishedAt: record.finishedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

@Injectable()
export class ProcessingService {
  readonly #logger = new Logger(ProcessingService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly repository: ProcessingRepository,
    private readonly cases: CasesService,
    private readonly documents: DocumentsService,
    private readonly audit: AuditService,
    private readonly queue: ProcessingQueuePublisher,
    private readonly metrics: MetricsService,
  ) {}

  async list(
    actor: ActorContext,
    query: ListProcessingJobsQueryDto,
    metadata: RequestAuditMetadata,
  ): Promise<CursorPage<ProcessingJobResponseDto>> {
    if (query.caseId !== undefined) {
      await this.cases.assertAccessibleForFileResources(
        actor,
        query.caseId,
        metadata,
        'PROCESSING',
      );
    }
    const cursor = decodeCursor(query.cursor, parseCursor);
    const rows = await this.repository.list(actor.organizationId, {
      ...(cursor === undefined ? {} : { cursor }),
      ...(query.caseId === undefined ? {} : { caseId: query.caseId }),
      ...(query.documentId === undefined ? {} : { documentId: query.documentId }),
      ...(query.jobType === undefined ? {} : { jobType: query.jobType }),
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.provider === undefined ? {} : { provider: query.provider }),
      ...(query.modelName === undefined ? {} : { modelName: query.modelName }),
      allowConfidential: actor.permissions.has('confidential_cases.read'),
      take: query.limit + 1,
    });
    const hasNextPage = rows.length > query.limit;
    const pageRows = hasNextPage ? rows.slice(0, query.limit) : rows;
    if (query.caseId === undefined) {
      const confidentialCount = pageRows.filter(
        (record) => record.case?.confidentialityLevel !== 'STANDARD',
      ).length;
      if (confidentialCount > 0) {
        await this.audit.recordDomain({
          organizationId: actor.organizationId,
          userId: actor.userId,
          entityId: null,
          entityType: 'case',
          action: 'case.confidential.read',
          newData: { access: 'PROCESSING', count: confidentialCount },
          ...metadata,
        });
      }
    }
    const last = pageRows.at(-1);
    return {
      data: pageRows.map(mapJob),
      pageInfo: {
        hasNextPage,
        nextCursor:
          hasNextPage && last !== undefined
            ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
            : null,
      },
    };
  }

  async get(
    actor: ActorContext,
    id: string,
    metadata: RequestAuditMetadata,
  ): Promise<ProcessingJobResponseDto> {
    const job = await this.repository.findById(actor.organizationId, id);
    if (job === null || job.caseId === null) {
      throw this.#notFound();
    }
    await this.cases.assertAccessibleForFileResources(actor, job.caseId, metadata, 'PROCESSING');
    return mapJob(job);
  }

  async reprocess(
    actor: ActorContext,
    documentId: string,
    metadata: RequestAuditMetadata,
  ): Promise<ProcessingJobResponseDto> {
    const target = await this.documents.getProcessingTarget(actor, documentId, metadata);
    if (target.fileStatus !== 'AVAILABLE' || target.virusScanStatus !== 'CLEAN') {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'FILE_NOT_AVAILABLE',
        'O arquivo ainda não está disponível para reprocessamento.',
      );
    }
    const job = await withTransaction(this.database.client, async (transaction) => {
      const created = await this.repository.createReprocessJob(transaction, {
        organizationId: actor.organizationId,
        caseId: target.caseId,
        fileId: target.fileId,
        documentId: target.id,
      });
      if (created === null) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'DOCUMENT_PROCESSING_ACTIVE',
          'O documento já possui um processamento em andamento.',
        );
      }
      await this.audit.recordDomainInTransaction(transaction, {
        organizationId: actor.organizationId,
        userId: actor.userId,
        entityId: target.id,
        entityType: 'document',
        action: 'document.reprocessed',
        newData: {
          caseId: target.caseId,
          fileId: target.fileId,
          processingJobId: created.id,
          jobType: 'OCR',
        },
        ...metadata,
      });
      return created;
    });
    try {
      await this.queue.publish({
        processingJobId: job.id,
        organizationId: actor.organizationId,
        correlationId: metadata.correlationId ?? metadata.requestId ?? randomUUID(),
        jobType: 'OCR',
      });
    } catch {
      // O job já foi persistido e o reconciliador o republicará. A métrica torna a
      // indisponibilidade da fila visível sem depender apenas dos logs.
      this.metrics.recordDeferredEnqueue();
      this.#logger.warn('processing_job_enqueue_deferred', {
        job_id: job.id,
        organization_id: actor.organizationId,
      });
    }
    return mapJob(job);
  }

  #notFound(): ApiException {
    return new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Recurso não encontrado.');
  }
}
