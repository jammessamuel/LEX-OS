import { promptFor } from '@lex-os/ai-prompts';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { RuntimeConfig } from '@lex-os/config';
import { Prisma } from '@lex-os/database';
import type { ProcessingJobMessageV1, ProcessingJobType } from '@lex-os/contracts';
import { assertEmbeddingBatch, chunkKnowledgeText, type EmbeddingProvider } from '@lex-os/shared';
import { UnrecoverableError } from 'bullmq';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import { ProcessingNotificationsService } from './processing-notifications.service.js';
import { TextExtractionService } from './text-extraction.service.js';
import { PROCESSING_PROVIDER, type ProcessingProvider } from './mock-processing.provider.js';
import { EMBEDDING_PROVIDER } from './mock-embedding.provider.js';
import { PermanentProcessingError, RetryableProcessingError } from './processing-error.js';
import {
  ProcessingRepository,
  type ClaimedProcessingJob,
  type StageCompletion,
} from './processing.repository.js';
import { PROCESSING_COST_POLICY, type ProcessingCostPolicy } from './processing-cost-policy.js';
import { ProcessingQueuePublisher } from './processing-queue.publisher.js';
import {
  CHECKLIST_ANALYSIS_PROVIDER,
  type ChecklistAnalysisProvider,
  sourceTextFrom,
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

type ProviderStageCompletion = Omit<StageCompletion, 'cost' | 'modelVersion'>;

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
    @Inject(PROCESSING_COST_POLICY) private readonly costPolicy: ProcessingCostPolicy,
    private readonly publisher: ProcessingQueuePublisher,
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
    private readonly notifications: ProcessingNotificationsService,
    private readonly textExtraction: TextExtractionService,
  ) {}

  /**
   * O prompt da tarefa para a área do caso.
   *
   * O que importa numa reclamação trabalhista não é o que importa num inventário, e a área já
   * viaja no job. Área sem prompt próprio cai no genérico; rascunho sobre acervo real é recusado
   * aqui, antes de o modelo ver qualquer coisa.
   */
  #promptFor(task: Parameters<typeof promptFor>[0], job: ClaimedProcessingJob) {
    return promptFor(task, job.document.case.legalArea, {
      caseArchive: this.config.caseArchive,
    });
  }

  async process(
    message: ProcessingJobMessageV1,
    expectedJobType: ProcessingJobType,
    deliveryAttempt: number,
    maximumAttempts: number,
  ): Promise<{ skipped: boolean; status?: string }> {
    const costQuote = this.costPolicy.quote(expectedJobType);
    const claim = await this.repository.claim(
      message.organizationId,
      message.processingJobId,
      expectedJobType,
      message.correlationId,
      costQuote,
    );
    if (claim.disposition === 'SKIP') {
      return claim.status === undefined
        ? { skipped: true }
        : { skipped: true, status: claim.status };
    }
    if (claim.disposition === 'BUDGET_LIMIT_REACHED') {
      return { skipped: false, status: 'PROCESSING_COST_LIMIT_REACHED' };
    }

    try {
      if (hasRetryOnceHook(claim.job.inputMetadata) && claim.job.attempts === 1) {
        throw new RetryableProcessingError(
          'MOCK_TRANSIENT_FAILURE',
          'Falha transitória simulada durante o processamento.',
        );
      }
      const providerCompletion = await this.#executeStage(claim.job);
      const completion: StageCompletion = {
        ...providerCompletion,
        modelVersion: costQuote.modelVersion,
        cost: this.costPolicy.measureSuccess(
          claim.job.jobType,
          providerCompletion.provider,
          providerCompletion.modelName,
        ),
      };
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

  async #executeStage(job: ClaimedProcessingJob): Promise<ProviderStageCompletion> {
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
        const result = await this.textExtraction.extract(job.document.file);
        const lido = result.provider === 'lex-os-text-reader';
        return {
          provider: result.provider,
          modelName: result.modelName,
          outputMetadata: {
            stage: 'OCR',
            progress: 50,
            characters: result.rawText.length,
            truncated: result.truncated,
          },
          extraction: {
            type: 'OCR',
            executionId: `${lido ? 'read' : 'mock'}-v1:${job.id}`,
            rawText: result.rawText,
            // A procedência diz se o texto veio do arquivo ou de simulação. Quem revisa uma
            // extração precisa saber qual dos dois está lendo.
            structuredData: {
              source: lido ? 'FILE_CONTENT' : 'DETERMINISTIC_MOCK',
              truncated: result.truncated,
            },
            confidenceScore: result.confidence,
            processingTimeMs: 1,
          },
          nextJobType: 'DOCUMENT_CLASSIFICATION',
        };
      }
      case 'DOCUMENT_CLASSIFICATION': {
        // O catálogo de tipos e o texto do documento: a classificação precisava dos dois e
        // não recebia nenhum. O mock ignora, o provedor real não vai poder.
        const classificationText = job.document.extractions[0]?.rawText ?? '';
        const result = this.provider.classify({
          availableTypeCodes: await this.repository.availableDocumentTypeCodes(job),
          sourceText: sourceTextFrom(classificationText),
        });
        return {
          provider: result.provider,
          modelName: result.modelName,
          outputMetadata: { stage: 'DOCUMENT_CLASSIFICATION', progress: 75 },
          extraction: {
            type: 'CLASSIFICATION',
            executionId: `mock-v1:${job.id}`,
            promptVersion: this.#promptFor('CLASSIFICATION', job).version,
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
        const entitiesText = job.document.extractions[0]?.rawText ?? '';
        const result = this.provider.extractEntities({
          sourceText: sourceTextFrom(entitiesText),
        });
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
            promptVersion: this.#promptFor('ENTITIES', job).version,
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
          sourceText: sourceTextFrom(sourceExtraction.rawText),
          prompt: this.#promptFor('TIMELINE', job),
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
          // Tipo de caso sem checklist ativo não é falha do documento: a etapa conclui sem
          // exigências e o pipeline segue para a indexação, mantendo o documento pesquisável.
          return {
            provider: 'lex-os-mock-checklist',
            modelName: 'deterministic-v1',
            outputMetadata: {
              stage: 'CHECKLIST_ANALYSIS',
              progress: 100,
              itemCount: 0,
              templateAvailable: false,
            },
            nextJobType: 'EMBEDDING',
          };
        }
        // O texto do documento chega aqui pela mesma extração que a cronologia usou; sem ele
        // a análise só poderia comparar códigos de tipo, que é o que o mock já faz sem modelo.
        const checklistText = job.document.extractions[0]?.rawText ?? null;
        const result = this.checklistAnalysisProvider.analyze({
          documentTypeCode: job.document.documentType?.code ?? null,
          sourceText: checklistText === null ? null : sourceTextFrom(checklistText),
          items: template.items,
          prompt: this.#promptFor('CHECKLIST', job),
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
      await this.repository.fail(
        job,
        code,
        safeMessage,
        correlationId,
        this.costPolicy.measureFailure(job.jobType, error),
      );
      // Só na falha terminal. Avisar a cada tentativa transformaria o aviso em ruído, e o
      // aviso que vira ruído deixa de ser lido — que é o mesmo que não existir.
      await this.notifications.documentFailed(job);
      if (permanent) {
        throw new UnrecoverableError(safeMessage);
      }
      throw new Error(safeMessage);
    }
    await this.repository.retry(job, code, safeMessage, correlationId);
    throw new Error(safeMessage);
  }
}
