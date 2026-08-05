import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@lex-os/database';
import type { ProcessingJobMessageV1, ProcessingJobType } from '@lex-os/contracts';
import { UnrecoverableError } from 'bullmq';

import { PROCESSING_PROVIDER, type ProcessingProvider } from './mock-processing.provider.js';
import { PermanentProcessingError, RetryableProcessingError } from './processing-error.js';
import {
  ProcessingRepository,
  type ClaimedProcessingJob,
  type StageCompletion,
} from './processing.repository.js';
import { ProcessingQueuePublisher } from './processing-queue.publisher.js';

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
      const completion = this.#executeStage(claim.job);
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

  #executeStage(job: ClaimedProcessingJob): StageCompletion {
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
        // Deliberate fail-closed placeholder. Delivery 7 ships no scanner adapter, so a file
        // that reached quarantine must never be released: every attempt is rejected, the
        // bounded retries are exhausted, and the job reaches a terminal failure with the
        // object still quarantined. Replacing this with a real scanner is a Delivery 11
        // production blocker — do not soften it into a pass-through in the meantime.
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
            progress: 100,
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
