import { Module } from '@nestjs/common';

import { RuntimeConfigModule } from '../config/runtime-config.module.js';
import { ProcessingQueuePublisher } from './processing-queue.publisher.js';

@Module({
  imports: [RuntimeConfigModule],
  providers: [ProcessingQueuePublisher],
  exports: [ProcessingQueuePublisher],
})
export class ProcessingQueueModule {}
