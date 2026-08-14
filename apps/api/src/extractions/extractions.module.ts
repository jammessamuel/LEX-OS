import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { ExtractionsController } from './extractions.controller.js';
import { ExtractionsRepository } from './extractions.repository.js';
import { ExtractionsService } from './extractions.service.js';

@Module({
  imports: [AuditModule, DocumentsModule],
  controllers: [ExtractionsController],
  providers: [ExtractionsRepository, ExtractionsService],
})
export class ExtractionsModule {}
