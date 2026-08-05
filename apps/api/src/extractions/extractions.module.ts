import { Module } from '@nestjs/common';

import { DocumentsModule } from '../documents/documents.module.js';
import { ExtractionsController } from './extractions.controller.js';
import { ExtractionsRepository } from './extractions.repository.js';
import { ExtractionsService } from './extractions.service.js';

@Module({
  imports: [DocumentsModule],
  controllers: [ExtractionsController],
  providers: [ExtractionsRepository, ExtractionsService],
})
export class ExtractionsModule {}
