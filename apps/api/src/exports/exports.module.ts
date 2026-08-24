import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { CasesModule } from '../cases/cases.module.js';
import { RuntimeConfigModule } from '../config/runtime-config.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { CaseExportPublisher } from './case-export.publisher.js';
import { CaseExportsController } from './case-exports.controller.js';
import { CaseExportsService } from './case-exports.service.js';

@Module({
  imports: [RuntimeConfigModule, DatabaseModule, StorageModule, CasesModule, AuditModule],
  controllers: [CaseExportsController],
  providers: [CaseExportsService, CaseExportPublisher],
})
export class ExportsModule {}
