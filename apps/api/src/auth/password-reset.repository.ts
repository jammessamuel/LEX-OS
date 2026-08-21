import { Injectable } from '@nestjs/common';
import type { TransactionClient } from '@lex-os/database';

import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class PasswordResetRepository {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Só pessoa ativa de escritório ativo. Convidada não tem senha a redefinir, e bloqueada
   * não deve ganhar um caminho de volta por aqui — o desbloqueio é decisão de quem
   * administra, não consequência de um clique em "esqueci a senha".
   */
  findResettableUser(organizationSlug: string, email: string) {
    return this.database.client.user.findFirst({
      where: {
        email,
        status: 'ACTIVE',
        deletedAt: null,
        organization: { slug: organizationSlug, status: 'ACTIVE', deletedAt: null },
      },
      select: {
        id: true,
        organizationId: true,
        name: true,
        email: true,
        organization: { select: { tradeName: true } },
      },
    });
  }

  async invalidateOpenRequests(
    transaction: TransactionClient,
    input: { organizationId: string; userId: string; at: Date },
  ): Promise<number> {
    const result = await transaction.passwordResetRequest.updateMany({
      where: { organizationId: input.organizationId, userId: input.userId, usedAt: null },
      data: { usedAt: input.at },
    });
    return result.count;
  }

  createRequest(
    transaction: TransactionClient,
    input: { organizationId: string; userId: string; tokenHash: string; expiresAt: Date },
  ): Promise<{ id: string }> {
    return transaction.passwordResetRequest.create({ data: input, select: { id: true } });
  }

  /**
   * Encontrado apenas pelo hash do token, sem tenant na consulta: quem redefine não tem
   * sessão, e o token é a única prova apresentada. A organização sai do registro achado.
   */
  findOpenByTokenHash(tokenHash: string, now: Date) {
    return this.database.client.passwordResetRequest.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: now },
        user: { status: 'ACTIVE', deletedAt: null },
        organization: { status: 'ACTIVE', deletedAt: null },
      },
      select: { id: true, organizationId: true, userId: true },
    });
  }

  async consume(
    transaction: TransactionClient,
    input: { id: string; organizationId: string; usedAt: Date },
  ): Promise<boolean> {
    const result = await transaction.passwordResetRequest.updateMany({
      where: { id: input.id, organizationId: input.organizationId, usedAt: null },
      data: { usedAt: input.usedAt },
    });
    return result.count === 1;
  }

  async setPassword(
    transaction: TransactionClient,
    input: { organizationId: string; userId: string; passwordHash: string },
  ): Promise<boolean> {
    const result = await transaction.user.updateMany({
      where: { id: input.userId, organizationId: input.organizationId, status: 'ACTIVE' },
      data: { passwordHash: input.passwordHash },
    });
    return result.count === 1;
  }

  async revokeSessions(
    transaction: TransactionClient,
    input: { organizationId: string; userId: string; revokedAt: Date },
  ): Promise<number> {
    const result = await transaction.refreshSession.updateMany({
      where: { organizationId: input.organizationId, userId: input.userId, revokedAt: null },
      data: { revokedAt: input.revokedAt, revocationReason: 'PASSWORD_RESET' },
    });
    return result.count;
  }
}
