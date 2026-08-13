import { Module } from '@nestjs/common';

import { AuditController } from './audit.controller.js';
import { AuditQueryService } from './audit-query.service.js';
import { AuditRepository } from './audit.repository.js';
import { AuditService } from './audit.service.js';

@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditQueryService, AuditRepository],
  exports: [AuditService],
})
export class AuditModule {}
