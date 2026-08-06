import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { CasesModule } from '../cases/cases.module.js';
import { ChecklistsController } from './checklists.controller.js';
import { ChecklistsRepository } from './checklists.repository.js';
import { ChecklistsService } from './checklists.service.js';

@Module({
  imports: [AuditModule, CasesModule],
  controllers: [ChecklistsController],
  providers: [ChecklistsRepository, ChecklistsService],
  exports: [ChecklistsService],
})
export class ChecklistsModule {}
