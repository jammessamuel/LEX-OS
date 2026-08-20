import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { InvitationsRepository } from './invitations.repository.js';
import { InvitationsService } from './invitations.service.js';
import { UsersController } from './users.controller.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [AuditModule],
  controllers: [UsersController],
  providers: [InvitationsRepository, InvitationsService, UsersRepository, UsersService],
  // O aceite do convite vive no modulo de autenticacao: ele acontece sem sessao, e e la que
  // esta a rota publica. So o servico atravessa a fronteira; o repositorio nao.
  exports: [InvitationsService],
})
export class UsersModule {}
