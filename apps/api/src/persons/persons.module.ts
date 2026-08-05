import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { PersonsController } from './persons.controller.js';
import { PersonsRepository } from './persons.repository.js';
import { PersonsService } from './persons.service.js';

@Module({
  imports: [AuditModule],
  controllers: [PersonsController],
  providers: [PersonsRepository, PersonsService],
  exports: [PersonsService],
})
export class PersonsModule {}
