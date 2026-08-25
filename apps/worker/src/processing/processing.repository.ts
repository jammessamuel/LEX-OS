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
import type { MeasuredProviderCost, ProviderCostQuote } from './processing-cost-policy.js';

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
  provider: true,
  modelName: true,
  modelVersion: true,
  reservedCostAmount: true,
  costAmount: true,
  costCurrency: true,
  inputMetadata: true,
  document: {
    select: {
      id: true,
      organizationId: true,
      caseId: true,
      fileId: true,
      deletedAt: true,
      documentType: { select: { id: true, code: true } },
      extractions: {
        where: { extractionType: 'OCR', status: 'COMPLETED' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 1,
        select: { id: true, rawText: true },
      },
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
      case: {
        select: {
          id: true,
          organizationId: true,
          legalArea: true,
          caseType: true,
          processingCostLimitAmount: true,
          processingCostSpentAmount: true,
          processingCostReservedAmount: true,
          processingCostCurrency: true,
          processingBudgetStatus: true,
          processingLimitReachedAt: true,
          deletedAt: true,
        },
      },
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

export interface ChecklistTemplateForProcessing {
  id: string;
  version: number;
  items: readonly {
    id: string;
    documentTypeCode: string | null;
  }[];
}

export type ClaimResult =
  | { disposition: 'PROCESS'; job: ClaimedProcessingJob }
  | { disposition: 'BUDGET_LIMIT_REACHED' }
  | { disposition: 'SKIP'; status?: JobStatus };

export interface StageCompletion {
  provider: string;
  modelName: string;
  modelVersion: string;
  cost: MeasuredProviderCost;
  outputMetadata: Prisma.InputJsonObject;
  extraction?: {
    type:
      'OCR' | 'CLASSIFICATION' | 'ENTITY_EXTRACTION' | 'TIMELINE_ANALYSIS' | 'CHECKLIST_ANALYSIS';
    executionId: string;
    rawText?: string;
    structuredData?: Prisma.InputJsonObject;
    confidenceScore?: number;
    processingTimeMs: number;
    promptVersion?: string;
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
  timeline?: {
    events: readonly {
      eventType: string;
      title: string;
      description: string;
      occurredAt: string;
      datePrecision: 'DAY';
      importance: 'NORMAL';
      sourceLocator: { pageNumber: number; startOffset: number; endOffset: number };
      confidenceScore: number;
    }[];
  };
  checklist?: {
    templateId: string;
    templateVersion: number;
    items: readonly {
      templateItemId: string;
      status: 'MISSING' | 'AWAITING_VALIDATION';
    }[];
  };
  knowledgeIndex?: {
    sourceExtractionId: string;
    embeddingVersion: string;
    embeddingDimensions: number;
    chunks: readonly {
      chunkIndex: number;
      content: string;
      contentHash: string;
      locator: { pageNumber: number; startOffset: number; endOffset: number };
      embedding: readonly number[];
    }[];
  };
  nextJobType?: ProcessingJobType;
  finalDocumentStatus?: 'NEEDS_REVIEW';
}

function asJson(value: object): Prisma.InputJsonObject {
  return { ...value } as Prisma.InputJsonObject;
}

function costDecimal(value: string): Prisma.Decimal {
  if (!/^(0|[1-9]\d{0,11})(\.\d{1,6})?$/u.test(value)) {
    throw new Error('Cost policy returned an invalid non-negative six-decimal amount.');
  }
  return new Prisma.Decimal(value);
}

function vectorLiteral(values: readonly number[], expectedDimensions: number): string {
  if (
    values.length !== expectedDimensions ||
    values.length === 0 ||
    values.some((value) => !Number.isFinite(value))
  ) {
    throw new Error('Cannot persist an invalid embedding vector.');
  }
  return `[${values.join(',')}]`;
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

  async findChecklistTemplate(
    job: ClaimedProcessingJob,
  ): Promise<ChecklistTemplateForProcessing | null> {
    const select = {
      id: true,
      version: true,
      items: {
        orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
        select: {
          id: true,
          documentType: { select: { code: true } },
        },
      },
    } satisfies Prisma.ChecklistTemplateSelect;
    const where = {
      legalArea: job.document.case.legalArea,
      caseType: job.document.case.caseType,
      isActive: true,
    } satisfies Prisma.ChecklistTemplateWhereInput;
    const template =
      (await this.database.client.checklistTemplate.findFirst({
        where: { ...where, organizationId: job.organizationId },
        orderBy: [{ version: 'desc' }, { id: 'asc' }],
        select,
      })) ??
      (await this.database.client.checklistTemplate.findFirst({
        where: { ...where, organizationId: null },
        orderBy: [{ version: 'desc' }, { id: 'asc' }],
        select,
      }));

    return template === null
      ? null
      : {
          id: template.id,
          version: template.version,
          items: template.items.map((item) => ({
            id: item.id,
            documentTypeCode: item.documentType?.code ?? null,
          })),
        };
  }

  async claim(
    organizationId: string,
    processingJobId: string,
    expectedJobType: ProcessingJobType,
    correlationId: string,
    costQuote: ProviderCostQuote,
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
      const quotedMaximum = costDecimal(costQuote.maximumAmount);
      let reservationToAdd = new Prisma.Decimal(0);
      if (current.status !== 'PROCESSING') {
        const budgets = await transaction.$queryRaw<
          Array<{
            limitAmount: string;
            spentAmount: string;
            reservedAmount: string;
            currency: string;
            status: 'ACTIVE' | 'LIMIT_REACHED';
          }>
        >(Prisma.sql`
          SELECT
            "processing_cost_limit_amount"::text AS "limitAmount",
            "processing_cost_spent_amount"::text AS "spentAmount",
            "processing_cost_reserved_amount"::text AS "reservedAmount",
            "processing_cost_currency" AS "currency",
            "processing_budget_status"::text AS "status"
          FROM "cases"
          WHERE "organization_id" = ${organizationId}::uuid
            AND "id" = ${current.caseId}::uuid
            AND "deleted_at" IS NULL
          FOR UPDATE
        `);
        const budget = budgets[0];
        if (budget === undefined || budget.currency !== costQuote.currency) {
          throw new Error('Processing cost quote does not match the locked case budget.');
        }
        reservationToAdd = current.reservedCostAmount.isZero()
          ? quotedMaximum
          : new Prisma.Decimal(0);
        const committedAfterReservation = costDecimal(budget.spentAmount)
          .add(costDecimal(budget.reservedAmount))
          .add(reservationToAdd);
        const blocked =
          (budget.status === 'LIMIT_REACHED' && current.reservedCostAmount.isZero()) ||
          committedAfterReservation.greaterThan(costDecimal(budget.limitAmount));
        if (blocked) {
          assertTransition(current.status, 'CANCELLED');
          const reachedAt = new Date();
          const cancelled = await transaction.processingJob.updateMany({
            where: {
              id: current.id,
              organizationId,
              status: current.status,
              version: current.version,
            },
            data: {
              status: 'CANCELLED',
              version: { increment: 1 },
              provider: costQuote.provider,
              modelName: costQuote.modelName,
              modelVersion: costQuote.modelVersion,
              costCurrency: costQuote.currency,
              outputMetadata: {
                stage: current.jobType,
                reason: 'PROCESSING_COST_LIMIT_REACHED',
              },
              errorCode: null,
              errorMessage: null,
              finishedAt: reachedAt,
            },
          });
          if (cancelled.count !== 1) {
            throw new Error('Budget cancellation lost an optimistic concurrency race.');
          }
          await transaction.case.updateMany({
            where: { id: current.caseId, organizationId, deletedAt: null },
            data: {
              processingBudgetStatus: 'LIMIT_REACHED',
              processingLimitReachedAt: reachedAt,
            },
          });
          await transaction.document.updateMany({
            where: { id: current.documentId, organizationId, deletedAt: null },
            data: { processingStatus: 'NEEDS_REVIEW' },
          });
          await this.#audit(transaction, {
            organizationId,
            processingJobId: current.id,
            actorType: 'SYSTEM',
            action: 'processing.budget.limit_reached',
            entityType: 'case',
            entityId: current.caseId,
            correlationId,
            data: {
              jobType: current.jobType,
              currency: costQuote.currency,
              reason: 'QUOTE_EXCEEDS_REMAINING_BUDGET',
            },
          });
          return { disposition: 'BUDGET_LIMIT_REACHED' };
        }
        if (!reservationToAdd.isZero()) {
          await transaction.case.updateMany({
            where: { id: current.caseId, organizationId, deletedAt: null },
            data: { processingCostReservedAmount: { increment: reservationToAdd } },
          });
        }
      }
      const reservedCostAmount = current.reservedCostAmount.add(reservationToAdd);
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
          provider: costQuote.provider,
          modelName: costQuote.modelName,
          modelVersion: costQuote.modelVersion,
          reservedCostAmount,
          costAmount: current.costAmount ?? new Prisma.Decimal(0),
          costCurrency: costQuote.currency,
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
          provider: costQuote.provider,
          modelName: costQuote.modelName,
          modelVersion: costQuote.modelVersion,
          reservedCostAmount,
          costAmount: current.costAmount ?? new Prisma.Decimal(0),
          costCurrency: costQuote.currency,
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
      const actualCost = costDecimal(completion.cost.amount);
      if (completion.cost.currency !== job.costCurrency) {
        throw new Error('Measured provider cost currency differs from its reservation.');
      }
      if (actualCost.greaterThan(job.reservedCostAmount)) {
        throw new Error('Measured provider cost exceeded its fail-closed reservation.');
      }
      let extractionId: string | undefined;
      if (completion.extraction !== undefined) {
        const extraction = await transaction.documentExtraction.create({
          data: {
            organizationId: job.organizationId,
            documentId: job.documentId,
            extractionType: completion.extraction.type,
            provider: completion.provider,
            modelName: completion.modelName,
            modelVersion: completion.modelVersion,
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
            // Quem passou por prompt declara a versão dele; quem não passou grava nulo.
            // Antes, tudo que não fosse OCR recebia 'deterministic-prompt-v1' — uma versão que
            // não correspondia a prompt nenhum, ou seja, procedência inventada.
            promptVersion: completion.extraction.promptVersion ?? null,
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

      if (completion.timeline !== undefined) {
        if (extractionId === undefined) {
          throw new Error('Timeline events require their analysis extraction.');
        }
        for (const [index, event] of completion.timeline.events.entries()) {
          const eventId = deterministicJobId(job.id, `TIMELINE_EVENT:${index}`);
          await transaction.timelineEvent.create({
            data: {
              id: eventId,
              organizationId: job.organizationId,
              caseId: job.caseId,
              eventType: event.eventType,
              title: event.title,
              description: event.description,
              occurredAt: new Date(event.occurredAt),
              datePrecision: event.datePrecision,
              importance: event.importance,
              sourceType: 'DOCUMENT',
              sourceId: job.documentId,
              sourceLocator: asJson(event.sourceLocator),
              extractionId,
              confidenceScore: event.confidenceScore,
              createdByActorType: 'AI',
              confirmedByUser: false,
            },
          });
          await this.#audit(transaction, {
            organizationId: job.organizationId,
            processingJobId: job.id,
            actorType: 'AI',
            action: 'timeline.event.created',
            entityType: 'timeline_event',
            entityId: eventId,
            correlationId,
            data: {
              caseId: job.caseId,
              eventType: event.eventType,
              sourceType: 'DOCUMENT',
              sourceId: job.documentId,
              extractionId,
              confirmedByUser: false,
            },
          });
        }
      }

      let caseChecklistId: string | undefined;
      if (completion.checklist !== undefined) {
        const template = await transaction.checklistTemplate.findFirst({
          where: {
            id: completion.checklist.templateId,
            version: completion.checklist.templateVersion,
            legalArea: job.document.case.legalArea,
            caseType: job.document.case.caseType,
            isActive: true,
            OR: [{ organizationId: null }, { organizationId: job.organizationId }],
          },
          select: {
            id: true,
            version: true,
            items: {
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
              select: {
                id: true,
                title: true,
                description: true,
                isRequired: true,
              },
            },
          },
        });
        if (template === null) {
          throw new Error('The checklist template is no longer available.');
        }
        const expectedItemIds = new Set(template.items.map((item) => item.id));
        if (
          completion.checklist.items.length !== expectedItemIds.size ||
          completion.checklist.items.some((item) => !expectedItemIds.has(item.templateItemId))
        ) {
          throw new Error('Checklist analysis does not match the selected template.');
        }

        const deterministicChecklistId = deterministicJobId(
          job.caseId,
          `CHECKLIST:${template.id}:${template.version}`,
        );
        const checklist = await transaction.caseChecklist.upsert({
          where: {
            caseId_templateId_templateVersion: {
              caseId: job.caseId,
              templateId: template.id,
              templateVersion: template.version,
            },
          },
          update: {},
          create: {
            id: deterministicChecklistId,
            organizationId: job.organizationId,
            caseId: job.caseId,
            templateId: template.id,
            templateVersion: template.version,
            status: 'IN_PROGRESS',
          },
          select: { id: true },
        });
        caseChecklistId = checklist.id;
        const inserted = await transaction.caseChecklistItem.createMany({
          data: template.items.map((item) => ({
            id: deterministicJobId(checklist.id, `CHECKLIST_ITEM:${item.id}`),
            organizationId: job.organizationId,
            caseId: job.caseId,
            caseChecklistId: checklist.id,
            templateItemId: item.id,
            titleSnapshot: item.title,
            descriptionSnapshot: item.description,
            isRequiredSnapshot: item.isRequired,
            status: 'MISSING',
          })),
          skipDuplicates: true,
        });
        if (inserted.count > 0) {
          await this.#audit(transaction, {
            organizationId: job.organizationId,
            processingJobId: job.id,
            actorType: 'SYSTEM',
            action: 'checklist.applied',
            entityType: 'case_checklist',
            entityId: checklist.id,
            correlationId,
            data: {
              caseId: job.caseId,
              templateId: template.id,
              templateVersion: template.version,
              itemCount: inserted.count,
            },
          });
        }

        let updatedItemCount = 0;
        for (const result of completion.checklist.items) {
          if (result.status !== 'AWAITING_VALIDATION') {
            continue;
          }
          const updated = await transaction.caseChecklistItem.updateMany({
            where: {
              organizationId: job.organizationId,
              caseId: job.caseId,
              caseChecklistId: checklist.id,
              templateItemId: result.templateItemId,
              status: 'MISSING',
            },
            data: { status: 'AWAITING_VALIDATION', documentId: job.documentId },
          });
          updatedItemCount += updated.count;
        }
        await transaction.caseChecklist.updateMany({
          where: { id: checklist.id, organizationId: job.organizationId, caseId: job.caseId },
          data: { status: 'NEEDS_REVIEW' },
        });
        await this.#audit(transaction, {
          organizationId: job.organizationId,
          processingJobId: job.id,
          actorType: 'AI',
          action: 'checklist.analysis.completed',
          entityType: 'case_checklist',
          entityId: checklist.id,
          correlationId,
          data: {
            caseId: job.caseId,
            documentId: job.documentId,
            updatedItemCount,
          },
        });
      }

      let indexedChunkCount: number | undefined;
      if (completion.knowledgeIndex !== undefined) {
        const sourceExtraction = job.document.extractions[0];
        if (
          sourceExtraction === undefined ||
          sourceExtraction.id !== completion.knowledgeIndex.sourceExtractionId
        ) {
          throw new Error('Knowledge indexing source does not match the current document text.');
        }

        indexedChunkCount = 0;
        for (const chunk of completion.knowledgeIndex.chunks) {
          const chunkId = deterministicJobId(
            completion.knowledgeIndex.sourceExtractionId,
            `KNOWLEDGE_CHUNK:${chunk.chunkIndex}:${chunk.contentHash}`,
          );
          const metadata = JSON.stringify({
            schemaVersion: 1,
            locator: chunk.locator,
            sourceExtractionId: completion.knowledgeIndex.sourceExtractionId,
          });
          const inserted = await transaction.$executeRaw(Prisma.sql`
            INSERT INTO "knowledge_chunks" (
              "id",
              "organization_id",
              "case_id",
              "document_id",
              "source_type",
              "source_id",
              "chunk_index",
              "content",
              "content_hash",
              "embedding",
              "embedding_provider",
              "embedding_model",
              "embedding_version",
              "embedding_dimensions",
              "metadata"
            ) VALUES (
              ${chunkId}::uuid,
              ${job.organizationId}::uuid,
              ${job.caseId}::uuid,
              ${job.documentId}::uuid,
              'DOCUMENT_EXTRACTION',
              ${completion.knowledgeIndex.sourceExtractionId}::uuid,
              ${chunk.chunkIndex},
              ${chunk.content},
              ${chunk.contentHash},
              ${vectorLiteral(chunk.embedding, completion.knowledgeIndex.embeddingDimensions)}::vector,
              ${completion.provider},
              ${completion.modelName},
              ${completion.knowledgeIndex.embeddingVersion},
              ${completion.knowledgeIndex.embeddingDimensions},
              ${metadata}::jsonb
            )
            ON CONFLICT (
              "organization_id", "source_type", "source_id", "chunk_index", "content_hash"
            ) DO NOTHING
          `);
          indexedChunkCount += inserted;
        }

        await this.#audit(transaction, {
          organizationId: job.organizationId,
          processingJobId: job.id,
          actorType: 'AI',
          action: 'knowledge.document.indexed',
          entityType: 'document',
          entityId: job.documentId,
          correlationId,
          data: {
            caseId: job.caseId,
            sourceExtractionId: completion.knowledgeIndex.sourceExtractionId,
            chunkCount: completion.knowledgeIndex.chunks.length,
            insertedChunkCount: indexedChunkCount,
            provider: completion.provider,
            modelName: completion.modelName,
            embeddingVersion: completion.knowledgeIndex.embeddingVersion,
            embeddingDimensions: completion.knowledgeIndex.embeddingDimensions,
          },
        });
      }

      const budgets = await transaction.$queryRaw<
        Array<{
          limitAmount: string;
          spentAmount: string;
          reservedAmount: string;
          currency: string;
          status: 'ACTIVE' | 'LIMIT_REACHED';
          limitReachedAt: Date | null;
        }>
      >(Prisma.sql`
        SELECT
          "processing_cost_limit_amount"::text AS "limitAmount",
          "processing_cost_spent_amount"::text AS "spentAmount",
          "processing_cost_reserved_amount"::text AS "reservedAmount",
          "processing_cost_currency" AS "currency",
          "processing_budget_status"::text AS "status",
          "processing_limit_reached_at" AS "limitReachedAt"
        FROM "cases"
        WHERE "organization_id" = ${job.organizationId}::uuid
          AND "id" = ${job.caseId}::uuid
          AND "deleted_at" IS NULL
        FOR UPDATE
      `);
      const budget = budgets[0];
      if (budget === undefined || budget.currency !== completion.cost.currency) {
        throw new Error('Measured provider cost does not match the locked case budget.');
      }
      const spentAmount = costDecimal(budget.spentAmount).add(actualCost);
      const reservedAmount = costDecimal(budget.reservedAmount).sub(job.reservedCostAmount);
      if (reservedAmount.isNegative()) {
        throw new Error('Case budget reservation accounting became negative.');
      }
      const limitAmount = costDecimal(budget.limitAmount);
      const budgetReached =
        budget.status === 'LIMIT_REACHED' ||
        (limitAmount.greaterThan(0) &&
          spentAmount.add(reservedAmount).greaterThanOrEqualTo(limitAmount));
      const limitReachedAt = budgetReached ? (budget.limitReachedAt ?? new Date()) : null;
      await transaction.case.updateMany({
        where: { id: job.caseId, organizationId: job.organizationId, deletedAt: null },
        data: {
          processingCostSpentAmount: spentAmount,
          processingCostReservedAmount: reservedAmount,
          processingBudgetStatus: budgetReached ? 'LIMIT_REACHED' : 'ACTIVE',
          processingLimitReachedAt: limitReachedAt,
        },
      });
      if (budgetReached) {
        await transaction.document.updateMany({
          where: { id: job.documentId, organizationId: job.organizationId, deletedAt: null },
          data: { processingStatus: 'NEEDS_REVIEW' },
        });
        if (budget.status !== 'LIMIT_REACHED') {
          await this.#audit(transaction, {
            organizationId: job.organizationId,
            processingJobId: job.id,
            actorType: 'SYSTEM',
            action: 'processing.budget.limit_reached',
            entityType: 'case',
            entityId: job.caseId,
            correlationId,
            data: {
              jobType: job.jobType,
              currency: completion.cost.currency,
              reason: 'COMMITTED_COST_REACHED_LIMIT',
            },
          });
        }
      }

      let nextJob: NextProcessingJob | null = null;
      if (completion.nextJobType !== undefined && !budgetReached) {
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
          modelVersion: completion.modelVersion,
          reservedCostAmount: 0,
          costAmount: (job.costAmount ?? new Prisma.Decimal(0)).add(actualCost),
          costCurrency: completion.cost.currency,
          outputMetadata: {
            ...completion.outputMetadata,
            ...(extractionId === undefined ? {} : { extractionId }),
            ...(caseChecklistId === undefined ? {} : { caseChecklistId }),
            ...(indexedChunkCount === undefined ? {} : { indexedChunkCount }),
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
        data: {
          jobType: job.jobType,
          nextProcessingJobId: nextJob?.id ?? null,
          provider: completion.provider,
          modelName: completion.modelName,
          modelVersion: completion.modelVersion,
          costAmount: actualCost.toFixed(6),
          costCurrency: completion.cost.currency,
          budgetReached,
        },
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
    measuredCost: MeasuredProviderCost,
  ): Promise<void> {
    await this.#terminalOrRetry(
      job,
      'FAILED',
      errorCode,
      errorMessage,
      correlationId,
      measuredCost,
    );
  }

  async cancel(
    organizationId: string,
    processingJobId: string,
    correlationId: string,
  ): Promise<boolean> {
    return withTransaction(this.database.client, async (transaction) => {
      const current = await transaction.processingJob.findFirst({
        where: { id: processingJobId, organizationId },
        select: { status: true, version: true, caseId: true, reservedCostAmount: true },
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
      if (!current.reservedCostAmount.isZero()) {
        if (current.caseId === null) {
          throw new Error('A reserved processing job must belong to a case.');
        }
        const budgets = await transaction.$queryRaw<Array<{ reservedAmount: string }>>(
          Prisma.sql`
            SELECT "processing_cost_reserved_amount"::text AS "reservedAmount"
            FROM "cases"
            WHERE "organization_id" = ${organizationId}::uuid
              AND "id" = ${current.caseId}::uuid
              AND "deleted_at" IS NULL
            FOR UPDATE
          `,
        );
        const budget = budgets[0];
        if (budget === undefined) {
          throw new Error('The cancelled job case budget no longer exists.');
        }
        const remaining = costDecimal(budget.reservedAmount).sub(current.reservedCostAmount);
        if (remaining.isNegative()) {
          throw new Error('Cancelled job released more budget than was reserved.');
        }
        await transaction.case.updateMany({
          where: { id: current.caseId, organizationId, deletedAt: null },
          data: { processingCostReservedAmount: remaining },
        });
      }
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
          reservedCostAmount: 0,
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
            'TIMELINE_GENERATION',
            'CHECKLIST_ANALYSIS',
            'EMBEDDING',
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
    measuredCost?: MeasuredProviderCost,
  ): Promise<void> {
    assertTransition('PROCESSING', status);
    await withTransaction(this.database.client, async (transaction) => {
      let terminalCost: Prisma.Decimal | undefined;
      if (status === 'FAILED') {
        if (measuredCost === undefined || measuredCost.currency !== job.costCurrency) {
          throw new Error('A failed provider execution requires measured cost in its currency.');
        }
        terminalCost = costDecimal(measuredCost.amount);
        if (terminalCost.greaterThan(job.reservedCostAmount)) {
          throw new Error('Failed provider cost exceeded its fail-closed reservation.');
        }
        const budgets = await transaction.$queryRaw<
          Array<{
            limitAmount: string;
            spentAmount: string;
            reservedAmount: string;
            status: 'ACTIVE' | 'LIMIT_REACHED';
            limitReachedAt: Date | null;
          }>
        >(Prisma.sql`
          SELECT
            "processing_cost_limit_amount"::text AS "limitAmount",
            "processing_cost_spent_amount"::text AS "spentAmount",
            "processing_cost_reserved_amount"::text AS "reservedAmount",
            "processing_budget_status"::text AS "status",
            "processing_limit_reached_at" AS "limitReachedAt"
          FROM "cases"
          WHERE "organization_id" = ${job.organizationId}::uuid
            AND "id" = ${job.caseId}::uuid
            AND "deleted_at" IS NULL
          FOR UPDATE
        `);
        const budget = budgets[0];
        if (budget === undefined) {
          throw new Error('The failed execution case budget no longer exists.');
        }
        const spentAmount = costDecimal(budget.spentAmount).add(terminalCost);
        const reservedAmount = costDecimal(budget.reservedAmount).sub(job.reservedCostAmount);
        const limitAmount = costDecimal(budget.limitAmount);
        if (reservedAmount.isNegative()) {
          throw new Error('Failed execution released more budget than was reserved.');
        }
        const budgetReached =
          budget.status === 'LIMIT_REACHED' ||
          (limitAmount.greaterThan(0) &&
            spentAmount.add(reservedAmount).greaterThanOrEqualTo(limitAmount));
        await transaction.case.updateMany({
          where: { id: job.caseId, organizationId: job.organizationId, deletedAt: null },
          data: {
            processingCostSpentAmount: spentAmount,
            processingCostReservedAmount: reservedAmount,
            processingBudgetStatus: budgetReached ? 'LIMIT_REACHED' : 'ACTIVE',
            processingLimitReachedAt: budgetReached ? (budget.limitReachedAt ?? new Date()) : null,
          },
        });
      }
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
          ...(status === 'FAILED'
            ? {
                reservedCostAmount: 0,
                costAmount: (job.costAmount ?? new Prisma.Decimal(0)).add(
                  terminalCost ?? new Prisma.Decimal(0),
                ),
              }
            : {}),
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
