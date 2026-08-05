import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { CasesController } from './cases.controller.js';
import { CasesRepository } from './cases.repository.js';
import { CasesService } from './cases.service.js';

@Module({
  imports: [AuditModule],
  controllers: [CasesController],
  providers: [CasesRepository, CasesService],
  exports: [CasesService],
})
export class CasesModule {}
