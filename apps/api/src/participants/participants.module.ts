import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { CasesModule } from '../cases/cases.module.js';
import { PersonsModule } from '../persons/persons.module.js';
import { ParticipantsController } from './participants.controller.js';
import { ParticipantsRepository } from './participants.repository.js';
import { ParticipantsService } from './participants.service.js';

@Module({
  imports: [AuditModule, CasesModule, PersonsModule],
  controllers: [ParticipantsController],
  providers: [ParticipantsRepository, ParticipantsService],
})
export class ParticipantsModule {}
