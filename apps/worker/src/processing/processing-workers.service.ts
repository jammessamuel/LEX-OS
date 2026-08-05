import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { RuntimeConfig } from '@lex-os/config';
import {
  parseProcessingJobMessage,
  processingQueueNames,
  type ProcessingJobType,
} from '@lex-os/contracts';
import { UnrecoverableError, Worker as BullWorker, type Job } from 'bullmq';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import { PipelineProcessorService } from './pipeline-processor.service.js';

@Injectable()
export class ProcessingWorkersService implements OnModuleInit, OnModuleDestroy {
  readonly #logger = new Logger(ProcessingWorkersService.name);
  readonly #workers: BullWorker[] = [];

  constructor(
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
    private readonly processor: PipelineProcessorService,
  ) {}

  onModuleInit(): void {
    for (const [jobType, queueName] of Object.entries(processingQueueNames) as [
      ProcessingJobType,
      string,
    ][]) {
      const worker = new BullWorker(
        queueName,
        async (delivery: Job) => {
          const message = parseProcessingJobMessage(delivery.data);
          if (delivery.id !== message.processingJobId) {
            throw new UnrecoverableError(
              'O identificador da entrega não corresponde ao job persistente.',
            );
          }
          const configuredAttempts =
            typeof delivery.opts.attempts === 'number'
              ? delivery.opts.attempts
              : this.config.processing.jobAttempts;
          return this.processor.process(
            message,
            jobType,
            delivery.attemptsMade + 1,
            configuredAttempts,
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
      worker.on('error', (error) => {
        this.#logger.error('processing_worker_error', error, { queue_name: queueName });
      });
      worker.on('failed', (job, error) => {
        this.#logger.warn('processing_delivery_failed', {
          queue_name: queueName,
          processing_job_id: job?.id,
          error_name: error.name,
        });
      });
      this.#workers.push(worker);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.#workers.map((worker) => worker.close()));
  }
}
