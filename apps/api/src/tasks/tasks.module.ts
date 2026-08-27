import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { CasesModule } from '../cases/cases.module.js';
import { RuntimeConfigModule } from '../config/runtime-config.module.js';
import { ChecklistsModule } from '../checklists/checklists.module.js';
import { TasksController } from './tasks.controller.js';
import { TasksRepository } from './tasks.repository.js';
import { TaskNotificationsService } from './task-notifications.service.js';
import { TasksService } from './tasks.service.js';

@Module({
  imports: [AuditModule, CasesModule, ChecklistsModule, RuntimeConfigModule],
  controllers: [TasksController],
  providers: [TaskNotificationsService, TasksRepository, TasksService],
})
export class TasksModule {}
