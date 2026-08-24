import { Module } from '@nestjs/common';

import { RuntimeConfigModule } from '../config/runtime-config.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { CaseExportProcessor } from './case-export.processor.js';
import { CaseExportRepository } from './case-export.repository.js';

@Module({
  imports: [RuntimeConfigModule, DatabaseModule, StorageModule],
  providers: [CaseExportProcessor, CaseExportRepository],
})
export class ExportModule {}
