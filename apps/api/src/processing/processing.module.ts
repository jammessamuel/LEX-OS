import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { CasesModule } from '../cases/cases.module.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { ProcessingController } from './processing.controller.js';
import { ProcessingQueueModule } from './processing-queue.module.js';
import { ProcessingRepository } from './processing.repository.js';
import { ProcessingService } from './processing.service.js';

@Module({
  imports: [AuditModule, CasesModule, DocumentsModule, ProcessingQueueModule],
  controllers: [ProcessingController],
  providers: [ProcessingRepository, ProcessingService],
})
export class ProcessingModule {}
