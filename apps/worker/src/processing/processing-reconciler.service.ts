import { randomUUID } from 'node:crypto';

import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { RuntimeConfig } from '@lex-os/config';
import { isProcessingJobType } from '@lex-os/contracts';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import { ProcessingQueuePublisher } from './processing-queue.publisher.js';
import { ProcessingRepository } from './processing.repository.js';

@Injectable()
export class ProcessingReconcilerService implements OnModuleInit, OnModuleDestroy {
  readonly #logger = new Logger(ProcessingReconcilerService.name);
  #timer: NodeJS.Timeout | undefined;

  constructor(
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
    private readonly repository: ProcessingRepository,
    private readonly publisher: ProcessingQueuePublisher,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.reconcileOnce();
    this.#timer = setInterval(
      () => void this.reconcileOnce().catch((error: unknown) => this.#logFailure(error)),
      this.config.processing.reconcileIntervalSeconds * 1_000,
    );
    this.#timer.unref();
  }

  async reconcileOnce(): Promise<number> {
    const cutoff = new Date(Date.now() - this.config.processing.staleAfterSeconds * 1_000);
    const jobs = await this.repository.staleReconcilable(cutoff, 100);
    let published = 0;
    for (const job of jobs) {
      if (!isProcessingJobType(job.jobType)) {
        continue;
      }
      if (await this.publisher.hasJob(job.jobType, job.id)) {
        continue;
      }
      await this.publisher.publish(job.jobType, {
        schemaVersion: 1,
        processingJobId: job.id,
        organizationId: job.organizationId,
        correlationId: randomUUID(),
      });
      published += 1;
    }
    if (published > 0) {
      this.#logger.log('processing_jobs_reconciled', { count: published });
    }
    return published;
  }

  onModuleDestroy(): void {
    if (this.#timer !== undefined) {
      clearInterval(this.#timer);
    }
  }

  #logFailure(error: unknown): void {
    this.#logger.error('processing_reconciliation_failed', error);
  }
}
