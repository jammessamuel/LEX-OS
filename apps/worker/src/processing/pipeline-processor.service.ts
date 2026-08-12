import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@lex-os/database';
import type { ProcessingJobMessageV1, ProcessingJobType } from '@lex-os/contracts';
import { assertEmbeddingBatch, chunkKnowledgeText, type EmbeddingProvider } from '@lex-os/shared';
import { UnrecoverableError } from 'bullmq';

import { PROCESSING_PROVIDER, type ProcessingProvider } from './mock-processing.provider.js';
import { EMBEDDING_PROVIDER } from './mock-embedding.provider.js';
import { PermanentProcessingError, RetryableProcessingError } from './processing-error.js';
import {
  ProcessingRepository,
  type ClaimedProcessingJob,
  type StageCompletion,
} from './processing.repository.js';
import { ProcessingQueuePublisher } from './processing-queue.publisher.js';
import {
  CHECKLIST_ANALYSIS_PROVIDER,
  type ChecklistAnalysisProvider,
  TIMELINE_PROVIDER,
  type TimelineProvider,
} from './review-processing.provider.js';

function hasRetryOnceHook(value: Prisma.JsonValue | null): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    value.mockFailureMode === 'RETRY_ONCE'
  );
}

@Injectable()
export class PipelineProcessorService {
  readonly #logger = new Logger(PipelineProcessorService.name);

  constructor(
    private readonly repository: ProcessingRepository,
    @Inject(PROCESSING_PROVIDER) private readonly provider: ProcessingProvider,
    @Inject(TIMELINE_PROVIDER) private readonly timelineProvider: TimelineProvider,
    @Inject(CHECKLIST_ANALYSIS_PROVIDER)
    private readonly checklistAnalysisProvider: ChecklistAnalysisProvider,
    @Inject(EMBEDDING_PROVIDER) private readonly embeddingProvider: EmbeddingProvider,
    private readonly publisher: ProcessingQueuePublisher,
  ) {}

  async process(
    message: ProcessingJobMessageV1,
    expectedJobType: ProcessingJobType,
    deliveryAttempt: number,
    maximumAttempts: number,
  ): Promise<{ skipped: boolean; status?: string }> {
    const claim = await this.repository.claim(
      message.organizationId,
      message.processingJobId,
      expectedJobType,
      message.correlationId,
    );
    if (claim.disposition === 'SKIP') {
      return claim.status === undefined
        ? { skipped: true }
        : { skipped: true, status: claim.status };
    }

    try {
      if (hasRetryOnceHook(claim.job.inputMetadata) && claim.job.attempts === 1) {
        throw new RetryableProcessingError(
          'MOCK_TRANSIENT_FAILURE',
          'Falha transitória simulada durante o processamento.',
        );
      }
      const completion = await this.#executeStage(claim.job);
      const child = await this.repository.complete(claim.job, completion, message.correlationId);
      if (child !== null) {
        try {
          await this.publisher.publish(child.jobType, {
            schemaVersion: 1,
            processingJobId: child.id,
            organizationId: child.organizationId,
            correlationId: message.correlationId,
          });
        } catch {
          this.#logger.warn('processing_child_enqueue_deferred', {
            processing_job_id: child.id,
            organization_id: child.organizationId,
          });
        }
      }
      return { skipped: false };
    } catch (error) {
      return this.#handleError(
        claim.job,
        message.correlationId,
        deliveryAttempt,
        maximumAttempts,
        error,
      );
    }
  }

  async #executeStage(job: ClaimedProcessingJob): Promise<StageCompletion> {
    switch (job.jobType) {
      case 'FILE_VALIDATION': {
        if (
          job.document.file.status !== 'AVAILABLE' ||
          job.document.file.virusScanStatus !== 'CLEAN'
        ) {
          throw new PermanentProcessingError(
            'FILE_NOT_AVAILABLE',
            'O arquivo não está liberado para processamento.',
          );
        }
        return {
          provider: 'lex-os-validator',
          modelName: 'deterministic-v1',
          outputMetadata: { stage: 'FILE_VALIDATION', progress: 25, validated: true },
          nextJobType: 'OCR',
        };
      }
      case 'VIRUS_SCAN':
        // Falha fechada intencional: a Entrega 7 não possui adaptador de antivírus. O arquivo
        // permanece em quarentena até esgotar as tentativas. Um antivírus real bloqueia a
        // produção da Entrega 11; até lá, esta etapa nunca pode liberar o arquivo por omissão.
        throw new RetryableProcessingError(
          'SCANNER_UNAVAILABLE',
          'O serviço de verificação antivírus está temporariamente indisponível.',
        );
      case 'OCR': {
        const result = this.provider.extractText(job.document.file.mimeType);
        return {
          provider: result.provider,
          modelName: result.modelName,
          outputMetadata: { stage: 'OCR', progress: 50 },
          extraction: {
            type: 'OCR',
            executionId: `mock-v1:${job.id}`,
            rawText: result.rawText,
            structuredData: { source: 'DETERMINISTIC_MOCK' },
            confidenceScore: result.confidence,
            processingTimeMs: 1,
          },
          nextJobType: 'DOCUMENT_CLASSIFICATION',
        };
      }
      case 'DOCUMENT_CLASSIFICATION': {
        const result = this.provider.classify();
        return {
          provider: result.provider,
          modelName: result.modelName,
          outputMetadata: { stage: 'DOCUMENT_CLASSIFICATION', progress: 75 },
          extraction: {
            type: 'CLASSIFICATION',
            executionId: `mock-v1:${job.id}`,
            structuredData: { documentTypeCode: result.code, requiresHumanReview: true },
            confidenceScore: result.confidence,
            processingTimeMs: 1,
          },
          classification: {
            documentTypeCode: result.code,
            confidenceScore: result.confidence,
          },
          nextJobType: 'ENTITY_EXTRACTION',
        };
      }
      case 'ENTITY_EXTRACTION': {
        const result = this.provider.extractEntities();
        return {
          provider: result.provider,
          modelName: result.modelName,
          outputMetadata: {
            stage: 'ENTITY_EXTRACTION',
            progress: 70,
            entityCount: result.entities.length,
          },
          extraction: {
            type: 'ENTITY_EXTRACTION',
            executionId: `mock-v1:${job.id}`,
            structuredData: { entityCount: result.entities.length },
            confidenceScore: 0.98,
            processingTimeMs: 1,
            entities: result.entities,
          },
          nextJobType: 'TIMELINE_GENERATION',
        };
      }
      case 'TIMELINE_GENERATION': {
        const sourceExtraction = job.document.extractions[0];
        if (sourceExtraction?.rawText === null || sourceExtraction?.rawText === undefined) {
          throw new PermanentProcessingError(
            'TIMELINE_SOURCE_MISSING',
            'A cronologia exige uma extração textual autorizada do mesmo documento.',
          );
        }
        const result = this.timelineProvider.generate({
          sourceTextLength: sourceExtraction.rawText.length,
        });
        return {
          provider: result.provider,
          modelName: result.modelName,
          outputMetadata: {
            stage: 'TIMELINE_GENERATION',
            progress: 85,
            eventCount: result.events.length,
          },
          extraction: {
            type: 'TIMELINE_ANALYSIS',
            executionId: `mock-v1:${job.id}`,
            structuredData: {
              schemaVersion: result.schemaVersion,
              sourceExtractionId: sourceExtraction.id,
              eventCount: result.events.length,
            },
            confidenceScore: Math.min(...result.events.map((event) => event.confidenceScore)),
            processingTimeMs: 1,
            promptVersion: result.promptVersion,
          },
          timeline: { events: result.events },
          nextJobType: 'CHECKLIST_ANALYSIS',
        };
      }
      case 'CHECKLIST_ANALYSIS': {
        const template = await this.repository.findChecklistTemplate(job);
        if (template === null || template.items.length === 0) {
          throw new PermanentProcessingError(
            'CHECKLIST_TEMPLATE_MISSING',
            'Não há checklist ativo para o tipo deste caso.',
          );
        }
        const result = this.checklistAnalysisProvider.analyze({
          documentTypeCode: job.document.documentType?.code ?? null,
          items: template.items,
        });
        return {
          provider: result.provider,
          modelName: result.modelName,
          outputMetadata: {
            stage: 'CHECKLIST_ANALYSIS',
            progress: 100,
            itemCount: result.items.length,
          },
          extraction: {
            type: 'CHECKLIST_ANALYSIS',
            executionId: `mock-v1:${job.id}`,
            structuredData: {
              schemaVersion: result.schemaVersion,
              templateId: template.id,
              templateVersion: template.version,
              itemCount: result.items.length,
            },
            processingTimeMs: 1,
            promptVersion: result.promptVersion,
          },
          checklist: {
            templateId: template.id,
            templateVersion: template.version,
            items: result.items,
          },
          nextJobType: 'EMBEDDING',
        };
      }
      case 'EMBEDDING': {
        const sourceExtraction = job.document.extractions[0];
        if (sourceExtraction?.rawText === null || sourceExtraction?.rawText === undefined) {
          throw new PermanentProcessingError(
            'EMBEDDING_SOURCE_MISSING',
            'A indexação exige uma extração textual autorizada do mesmo documento.',
          );
        }
        const chunks = chunkKnowledgeText(sourceExtraction.rawText);
        if (chunks.length === 0) {
          throw new PermanentProcessingError(
            'EMBEDDING_SOURCE_EMPTY',
            'A extração textual não contém conteúdo pesquisável.',
          );
        }
        const embeddings = await this.embeddingProvider.embed(chunks.map((chunk) => chunk.content));
        assertEmbeddingBatch(
          embeddings,
          chunks.length,
          this.embeddingProvider.descriptor.dimensions,
        );
        return {
          provider: this.embeddingProvider.descriptor.provider,
          modelName: this.embeddingProvider.descriptor.model,
          outputMetadata: {
            stage: 'EMBEDDING',
            progress: 100,
            chunkCount: chunks.length,
          },
          knowledgeIndex: {
            sourceExtractionId: sourceExtraction.id,
            embeddingVersion: this.embeddingProvider.descriptor.version,
            embeddingDimensions: this.embeddingProvider.descriptor.dimensions,
            chunks: chunks.map((chunk, index) => ({
              ...chunk,
              embedding: embeddings[index] ?? [],
            })),
          },
          finalDocumentStatus: 'NEEDS_REVIEW',
        };
      }
    }
  }

  async #handleError(
    job: ClaimedProcessingJob,
    correlationId: string,
    deliveryAttempt: number,
    maximumAttempts: number,
    error: unknown,
  ): Promise<never> {
    const permanent = error instanceof PermanentProcessingError;
    const code =
      error instanceof RetryableProcessingError || permanent
        ? error.code
        : 'PROCESSING_INTERNAL_ERROR';
    const safeMessage =
      error instanceof RetryableProcessingError || permanent
        ? error.safeMessage
        : 'Não foi possível concluir o processamento.';
    const finalAttempt = permanent || deliveryAttempt >= maximumAttempts;
    if (finalAttempt) {
      await this.repository.fail(job, code, safeMessage, correlationId);
      if (permanent) {
        throw new UnrecoverableError(safeMessage);
      }
      throw new Error(safeMessage);
    }
    await this.repository.retry(job, code, safeMessage, correlationId);
    throw new Error(safeMessage);
  }
}
