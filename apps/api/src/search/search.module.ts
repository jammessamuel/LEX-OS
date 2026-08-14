import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { RuntimeConfigModule } from '../config/runtime-config.module.js';
import {
  MockSearchEmbeddingProvider,
  SEARCH_EMBEDDING_PROVIDER,
} from './mock-search-embedding.provider.js';
import { SearchController } from './search.controller.js';
import { SearchRepository } from './search.repository.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [AuditModule, RuntimeConfigModule],
  controllers: [SearchController],
  providers: [
    SearchRepository,
    SearchService,
    { provide: SEARCH_EMBEDDING_PROVIDER, useClass: MockSearchEmbeddingProvider },
  ],
  exports: [SearchService],
})
export class SearchModule {}
