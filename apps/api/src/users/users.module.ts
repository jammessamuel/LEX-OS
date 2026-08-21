import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { RuntimeConfigModule } from '../config/runtime-config.module.js';
import { EmailOutboxRepository } from './email-outbox.repository.js';
import { InvitationsRepository } from './invitations.repository.js';
import { InvitationsService } from './invitations.service.js';
import { RoleGrantService } from './role-grant.service.js';
import { RolesController } from './roles.controller.js';
import { UsersController } from './users.controller.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [AuditModule, RuntimeConfigModule],
  controllers: [RolesController, UsersController],
  providers: [
    EmailOutboxRepository,
    InvitationsRepository,
    InvitationsService,
    RoleGrantService,
    UsersRepository,
    UsersService,
  ],
  // O aceite do convite vive no modulo de autenticacao: ele acontece sem sessao, e e la que
  // esta a rota publica. So o servico atravessa a fronteira; o repositorio nao.
  exports: [EmailOutboxRepository, InvitationsService],
})
export class UsersModule {}
