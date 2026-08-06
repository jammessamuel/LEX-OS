import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { CasesModule } from '../cases/cases.module.js';
import { TimelineController } from './timeline.controller.js';
import { TimelineRepository } from './timeline.repository.js';
import { TimelineService } from './timeline.service.js';

@Module({
  imports: [AuditModule, CasesModule],
  controllers: [TimelineController],
  providers: [TimelineRepository, TimelineService],
})
export class TimelineModule {}
