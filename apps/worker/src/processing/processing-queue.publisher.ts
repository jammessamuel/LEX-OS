import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { RuntimeConfig } from '@lex-os/config';
import {
  createProcessingJobMessage,
  processingQueueNames,
  queueNameForJobType,
  type ProcessingJobMessageV1,
  type ProcessingJobType,
  type ProcessingQueueName,
} from '@lex-os/contracts';
import { Queue } from 'bullmq';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';

@Injectable()
export class ProcessingQueuePublisher implements OnModuleDestroy {
  readonly #queues = new Map<ProcessingQueueName, Queue>();

  constructor(@Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig) {
    for (const queueName of new Set(Object.values(processingQueueNames))) {
      this.#queues.set(
        queueName,
        new Queue(queueName, {
          prefix: config.processing.queuePrefix,
          connection: {
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password,
            connectTimeout: config.service.dependencyTimeoutMs,
            maxRetriesPerRequest: 1,
          },
        }),
      );
    }
  }

  async publish(jobType: ProcessingJobType, input: ProcessingJobMessageV1): Promise<void> {
    const queue = this.#queues.get(queueNameForJobType(jobType));
    if (queue === undefined) {
      throw new Error(`Processing queue for ${jobType} is not configured.`);
    }
    const message = createProcessingJobMessage({
      processingJobId: input.processingJobId,
      organizationId: input.organizationId,
      correlationId: input.correlationId,
    });
    await queue.add('processing-job-v1', message, {
      jobId: input.processingJobId,
      attempts: this.config.processing.jobAttempts,
      backoff: { type: 'exponential', delay: this.config.processing.jobBackoffMs },
      removeOnComplete: { age: 86_400, count: 10_000 },
      removeOnFail: { age: 604_800, count: 10_000 },
    });
  }

  async hasJob(jobType: ProcessingJobType, processingJobId: string): Promise<boolean> {
    const queue = this.#queues.get(queueNameForJobType(jobType));
    return (await queue?.getJob(processingJobId)) !== undefined;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.#queues.values()].map((queue) => queue.close()));
  }
}
