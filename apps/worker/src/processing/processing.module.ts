import { Module } from '@nestjs/common';

import { RuntimeConfigModule } from '../config/runtime-config.module.js';
import { MockProcessingProvider, PROCESSING_PROVIDER } from './mock-processing.provider.js';
import { PipelineProcessorService } from './pipeline-processor.service.js';
import { ProcessingQueuePublisher } from './processing-queue.publisher.js';
import { ProcessingReconcilerService } from './processing-reconciler.service.js';
import { ProcessingRepository } from './processing.repository.js';
import { ProcessingWorkersService } from './processing-workers.service.js';

@Module({
  imports: [RuntimeConfigModule],
  providers: [
    { provide: PROCESSING_PROVIDER, useClass: MockProcessingProvider },
    PipelineProcessorService,
    ProcessingQueuePublisher,
    ProcessingReconcilerService,
    ProcessingRepository,
    ProcessingWorkersService,
  ],
  exports: [ProcessingReconcilerService, ProcessingRepository],
})
export class ProcessingModule {}
