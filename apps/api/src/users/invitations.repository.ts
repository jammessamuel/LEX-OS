import { Injectable } from '@nestjs/common';
import { Prisma, type TransactionClient } from '@lex-os/database';

import { DatabaseService } from '../database/database.service.js';

const invitedUserSelect = {
  id: true,
  name: true,
  email: true,
  status: true,
} satisfies Prisma.UserSelect;

export type InvitedUserRecord = Prisma.UserGetPayload<{ select: typeof invitedUserSelect }>;

const pendingInvitationSelect = {
  id: true,
  organizationId: true,
  userId: true,
  expiresAt: true,
  user: { select: invitedUserSelect },
} satisfies Prisma.UserInvitationSelect;

export type PendingInvitationRecord = Prisma.UserInvitationGetPayload<{
  select: typeof pendingInvitationSelect;
}>;

@Injectable()
export class InvitationsRepository {
  constructor(private readonly database: DatabaseService) {}

  findOrganizationName(organizationId: string): Promise<{ tradeName: string } | null> {
    return this.database.client.organization.findUnique({
      where: { id: organizationId },
      select: { tradeName: true },
    });
  }

  findActiveUserByEmail(organizationId: string, email: string) {
    return this.database.client.user.findUnique({
      where: { organizationId_email: { organizationId, email } },
      select: { id: true, status: true, deletedAt: true },
    });
  }

  createInvitedUser(
    transaction: TransactionClient,
    input: {
      organizationId: string;
      name: string;
      email: string;
      placeholderPasswordHash: string;
      roleIds: readonly string[];
    },
  ): Promise<InvitedUserRecord> {
    return transaction.user.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        email: input.email,
        // A pessoa ainda não escolheu senha. Guardar um hash de valor inalcançável em vez de
        // string vazia mantém a coluna com a forma de sempre e faz qualquer tentativa de
        // entrar antes do aceite falhar na verificação, não em um caso especial.
        passwordHash: input.placeholderPasswordHash,
        status: 'INVITED',
        userRoles: { create: input.roleIds.map((roleId) => ({ roleId })) },
      },
      select: invitedUserSelect,
    });
  }

  createInvitation(
    transaction: TransactionClient,
    input: {
      organizationId: string;
      userId: string;
      tokenHash: string;
      expiresAt: Date;
      invitedById: string;
    },
  ): Promise<{ id: string }> {
    return transaction.userInvitation.create({ data: input, select: { id: true } });
  }

  /**
   * O convite é encontrado só pelo hash do token — nunca por identificador vindo do cliente.
   * Sem tenant na consulta de propósito: quem aceita ainda não tem sessão, e o token é a única
   * prova que ele apresenta. A organização sai do registro encontrado.
   */
  findPendingByTokenHash(tokenHash: string, now: Date): Promise<PendingInvitationRecord | null> {
    return this.database.client.userInvitation.findFirst({
      where: {
        tokenHash,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
        user: { status: 'INVITED', deletedAt: null },
        organization: { status: 'ACTIVE', deletedAt: null },
      },
      select: pendingInvitationSelect,
    });
  }

  /**
   * Consome o convite marcando o aceite com o estado esperado no `where`. Duas requisições
   * simultâneas com o mesmo token disputam esta cláusula e só uma altera linha: uso único é
   * garantido pelo banco, não por checagem prévia.
   */
  async consumeInvitation(
    transaction: TransactionClient,
    input: { id: string; organizationId: string; acceptedAt: Date },
  ): Promise<boolean> {
    const result = await transaction.userInvitation.updateMany({
      where: {
        id: input.id,
        organizationId: input.organizationId,
        acceptedAt: null,
        revokedAt: null,
      },
      data: { acceptedAt: input.acceptedAt },
    });
    return result.count === 1;
  }

  async activateInvitedUser(
    transaction: TransactionClient,
    input: { organizationId: string; userId: string; passwordHash: string },
  ): Promise<boolean> {
    const result = await transaction.user.updateMany({
      where: { id: input.userId, organizationId: input.organizationId, status: 'INVITED' },
      data: { passwordHash: input.passwordHash, status: 'ACTIVE' },
    });
    return result.count === 1;
  }

  /** Convites ainda abertos do escritório, para a tela mostrar quem está pendente. */
  listPending(organizationId: string, now: Date) {
    return this.database.client.userInvitation.findMany({
      where: {
        organizationId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
        user: { deletedAt: null },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
      select: pendingInvitationSelect,
    });
  }

  async revoke(input: { id: string; organizationId: string; revokedAt: Date }): Promise<boolean> {
    const result = await this.database.client.userInvitation.updateMany({
      where: {
        id: input.id,
        organizationId: input.organizationId,
        acceptedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: input.revokedAt },
    });
    return result.count === 1;
  }
}
