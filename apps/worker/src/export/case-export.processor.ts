import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { RuntimeConfig } from '@lex-os/config';
import { caseExportQueueName, parseProcessingJobMessage } from '@lex-os/contracts';
import { caseDossierObjectKey, cnjSegmentName } from '@lex-os/shared';
import { UnrecoverableError, Worker as BullWorker, type Job } from 'bullmq';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import { OBJECT_WRITER, type ObjectWriter } from '../storage/object-writer.js';
import { renderCaseDossier } from './case-dossier.js';
import { CaseExportRepository } from './case-export.repository.js';

@Injectable()
export class CaseExportProcessor implements OnModuleInit, OnModuleDestroy {
  readonly #logger = new Logger(CaseExportProcessor.name);
  #worker: BullWorker | undefined;

  constructor(
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
    @Inject(OBJECT_WRITER) private readonly storage: ObjectWriter,
    private readonly repository: CaseExportRepository,
  ) {}

  onModuleInit(): void {
    this.#worker = new BullWorker(
      caseExportQueueName,
      async (delivery: Job) => {
        const message = parseProcessingJobMessage(delivery.data);
        if (delivery.id !== message.processingJobId) {
          throw new UnrecoverableError(
            'O identificador da entrega não corresponde ao job persistente.',
          );
        }
        const attempts =
          typeof delivery.opts.attempts === 'number'
            ? delivery.opts.attempts
            : this.config.processing.jobAttempts;
        await this.process(
          message.organizationId,
          message.processingJobId,
          delivery.attemptsMade + 1,
          attempts,
        );
      },
      {
        prefix: this.config.processing.queuePrefix,
        concurrency: this.config.processing.workerConcurrency,
        connection: {
          host: this.config.redis.host,
          port: this.config.redis.port,
          password: this.config.redis.password,
          connectTimeout: this.config.service.dependencyTimeoutMs,
          maxRetriesPerRequest: null,
        },
      },
    );
    this.#worker.on('error', (error) => {
      this.#logger.error('case_export_worker_error', error);
    });
  }

  async process(
    organizationId: string,
    jobId: string,
    attempt: number,
    maxAttempts: number,
  ): Promise<void> {
    const claimed = await this.repository.claim(organizationId, jobId);
    if (claimed === null) {
      // Já concluído, cancelado, ou tomado por outra entrega. Repetir geraria o mesmo PDF.
      return;
    }

    try {
      const dossier = await this.repository.dossier(organizationId, claimed.caseId);
      if (dossier === null) {
        // O caso sumiu entre o pedido e o processamento. Repetir não traz de volta.
        throw new UnrecoverableError('O caso não está mais disponível para exportação.');
      }

      const generatedBy = await this.repository.requesterName(
        organizationId,
        claimed.requestedById,
      );
      const pdf = await renderCaseDossier({
        ...dossier,
        generatedBy,
        legalCase: {
          ...dossier.legalCase,
          cnjSegment:
            dossier.legalCase.cnjNumber === null
              ? null
              : cnjSegmentName(dossier.legalCase.cnjNumber),
        },
      });

      const key = caseDossierObjectKey(organizationId, claimed.caseId, jobId);
      await this.storage.writeObject({
        bucket: this.config.objectStorage.bucket,
        key,
        body: pdf,
        contentType: 'application/pdf',
      });
      // Só o tamanho. O balde vem da configuração e a chave é derivada dos identificadores:
      // `outputMetadata` é devolvido inteiro pela rota de acompanhamento, e o layout do
      // armazenamento não tem por que sair de casa.
      await this.repository.complete(organizationId, jobId, claimed.caseId, {
        byteSize: pdf.byteLength,
      });
      this.#logger.log('case_export_generated', { jobId, byteSize: pdf.byteLength });
    } catch (error) {
      const permanent = error instanceof UnrecoverableError || attempt >= maxAttempts;
      await this.repository.fail(
        organizationId,
        jobId,
        {
          code: permanent ? 'CASE_EXPORT_FAILED' : 'CASE_EXPORT_RETRYING',
          // A mensagem vai para uma coluna que a API expõe: nada de caminho, chave ou texto
          // do caso — só o motivo.
          message: error instanceof Error ? error.message : 'Falha ao gerar o dossiê.',
        },
        permanent,
      );
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.#worker?.close();
  }
}
