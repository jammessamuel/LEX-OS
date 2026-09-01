import { Module } from '@nestjs/common';

import { RuntimeConfigModule } from '../config/runtime-config.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { MockProcessingProvider, PROCESSING_PROVIDER } from './mock-processing.provider.js';
import { MockProcessingCostPolicy, PROCESSING_COST_POLICY } from './processing-cost-policy.js';
import { EMBEDDING_PROVIDER, MockEmbeddingProvider } from './mock-embedding.provider.js';
import { PipelineProcessorService } from './pipeline-processor.service.js';
import { PreparationDigestService } from './preparation-digest.service.js';
import { ProcessingNotificationsService } from './processing-notifications.service.js';
import { TextExtractionService } from './text-extraction.service.js';
import { ProcessingQueuePublisher } from './processing-queue.publisher.js';
import { ProcessingReconcilerService } from './processing-reconciler.service.js';
import { ProcessingRepository } from './processing.repository.js';
import { ProcessingWorkersService } from './processing-workers.service.js';
import {
  CHECKLIST_ANALYSIS_PROVIDER,
  MockReviewProcessingProvider,
  TIMELINE_PROVIDER,
} from './review-processing.provider.js';

@Module({
  imports: [RuntimeConfigModule, StorageModule],
  providers: [
    ProcessingNotificationsService,
    TextExtractionService,
    { provide: PROCESSING_PROVIDER, useClass: MockProcessingProvider },
    { provide: PROCESSING_COST_POLICY, useClass: MockProcessingCostPolicy },
    { provide: EMBEDDING_PROVIDER, useClass: MockEmbeddingProvider },
    MockReviewProcessingProvider,
    { provide: TIMELINE_PROVIDER, useExisting: MockReviewProcessingProvider },
    { provide: CHECKLIST_ANALYSIS_PROVIDER, useExisting: MockReviewProcessingProvider },
    PipelineProcessorService,
    PreparationDigestService,
    ProcessingQueuePublisher,
    ProcessingReconcilerService,
    ProcessingRepository,
    ProcessingWorkersService,
  ],
  exports: [ProcessingReconcilerService, ProcessingRepository],
})
export class ProcessingModule {}
