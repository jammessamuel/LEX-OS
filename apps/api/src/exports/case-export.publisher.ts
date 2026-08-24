import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { RuntimeConfig } from '@lex-os/config';
import { caseExportQueueName, createProcessingJobMessage } from '@lex-os/contracts';
import { Queue } from 'bullmq';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';

@Injectable()
export class CaseExportPublisher implements OnModuleDestroy {
  readonly #queue: Queue;

  constructor(@Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig) {
    this.#queue = new Queue(caseExportQueueName, {
      prefix: config.processing.queuePrefix,
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        connectTimeout: config.service.dependencyTimeoutMs,
        maxRetriesPerRequest: 1,
      },
    });
  }

  async publish(input: {
    processingJobId: string;
    organizationId: string;
    correlationId: string;
  }): Promise<void> {
    await this.#queue.add('processing-job-v1', createProcessingJobMessage(input), {
      // O id da entrega é o do trabalho persistente: publicar duas vezes o mesmo pedido não
      // cria duas entregas, e o BullMQ descarta a segunda sozinho.
      jobId: input.processingJobId,
      attempts: this.config.processing.jobAttempts,
      backoff: { type: 'exponential', delay: this.config.processing.jobBackoffMs },
      removeOnComplete: { age: 86_400, count: 10_000 },
      removeOnFail: { age: 604_800, count: 10_000 },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.#queue.close();
  }
}
