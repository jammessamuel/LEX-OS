import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { CasesModule } from '../cases/cases.module.js';
import { RuntimeConfigModule } from '../config/runtime-config.module.js';
import { ObservabilityModule } from '../observability/observability.module.js';
import { ProcessingQueueModule } from '../processing/processing-queue.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { FilesController } from './files.controller.js';
import { FilesRepository } from './files.repository.js';
import { FilesService } from './files.service.js';
import { MockVirusScanner } from './mock-virus-scanner.js';
import { StorageReconciliationService } from './storage-reconciliation.service.js';
import { VIRUS_SCANNER } from './virus-scanner.js';

@Module({
  imports: [
    AuditModule,
    CasesModule,
    ObservabilityModule,
    ProcessingQueueModule,
    RuntimeConfigModule,
    StorageModule,
  ],
  controllers: [FilesController],
  providers: [
    FilesRepository,
    FilesService,
    MockVirusScanner,
    StorageReconciliationService,
    { provide: VIRUS_SCANNER, useExisting: MockVirusScanner },
  ],
  exports: [StorageReconciliationService],
})
export class FilesModule {}
