import { Injectable } from '@nestjs/common';
import { Prisma, type TransactionClient } from '@lex-os/database';

import { DatabaseService } from '../database/database.service.js';

const assignableUserSelect = {
  id: true,
  name: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type AssignableUserRecord = Prisma.UserGetPayload<{
  select: typeof assignableUserSelect;
}>;

export interface AssignableUserCursor {
  createdAt: Date;
  id: string;
}

const managedUserSelect = {
  id: true,
  name: true,
  email: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  userRoles: { select: { role: { select: { id: true, name: true, code: true } } } },
} satisfies Prisma.UserSelect;

export type ManagedUserRecord = Prisma.UserGetPayload<{ select: typeof managedUserSelect }>;

@Injectable()
export class UsersRepository {
  constructor(private readonly database: DatabaseService) {}

  listAssignable(
    organizationId: string,
    input: { cursor?: AssignableUserCursor; take: number },
  ): Promise<AssignableUserRecord[]> {
    return this.database.client.user.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
        deletedAt: null,
        ...(input.cursor === undefined
          ? {}
          : {
              OR: [
                { createdAt: { gt: input.cursor.createdAt } },
                { createdAt: input.cursor.createdAt, id: { gt: input.cursor.id } },
              ],
            }),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: input.take,
      select: assignableUserSelect,
    });
  }

  /** Pessoas do escritório para a tela de administração, incluindo bloqueadas e convidadas. */
  listManaged(
    organizationId: string,
    input: { cursor?: AssignableUserCursor; take: number },
  ): Promise<ManagedUserRecord[]> {
    return this.database.client.user.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(input.cursor === undefined
          ? {}
          : {
              OR: [
                { createdAt: { gt: input.cursor.createdAt } },
                { createdAt: input.cursor.createdAt, id: { gt: input.cursor.id } },
              ],
            }),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: input.take,
      select: managedUserSelect,
    });
  }

  findManaged(organizationId: string, id: string): Promise<ManagedUserRecord | null> {
    return this.database.client.user.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: managedUserSelect,
    });
  }

  /**
   * Troca o conjunto inteiro de papéis. Apagar e recriar dentro da transação evita a
   * aritmética de diferença entre dois conjuntos, que é onde mora o erro de deixar um papel
   * a mais por engano.
   */
  async replaceRoles(
    transaction: TransactionClient,
    input: { organizationId: string; userId: string; roleIds: readonly string[] },
  ): Promise<void> {
    await transaction.userRole.deleteMany({
      where: { userId: input.userId, user: { organizationId: input.organizationId } },
    });
    if (input.roleIds.length > 0) {
      await transaction.userRole.createMany({
        data: input.roleIds.map((roleId) => ({ userId: input.userId, roleId })),
      });
    }
  }

  /**
   * Estado esperado no `where`: reativar só age sobre bloqueado, bloquear só sobre ativo.
   * Duas requisições simultâneas não se sobrepõem, e o tenant entra na mesma cláusula.
   */
  async changeStatus(
    transaction: TransactionClient,
    input: {
      organizationId: string;
      userId: string;
      from: readonly ('INVITED' | 'ACTIVE' | 'BLOCKED' | 'INACTIVE')[];
      to: 'ACTIVE' | 'BLOCKED';
    },
  ): Promise<boolean> {
    const result = await transaction.user.updateMany({
      where: {
        id: input.userId,
        organizationId: input.organizationId,
        deletedAt: null,
        status: { in: [...input.from] },
      },
      data: { status: input.to },
    });
    return result.count === 1;
  }

  /**
   * Bloquear precisa fechar também o caminho de renovação. O guard já reconsulta o estado a
   * cada requisição, então o acesso morre na chamada seguinte de qualquer forma; revogar as
   * sessões impede que o refresh emita um token novo depois disso.
   */
  async revokeSessions(
    transaction: TransactionClient,
    input: { organizationId: string; userId: string; revokedAt: Date; reason: string },
  ): Promise<number> {
    const result = await transaction.refreshSession.updateMany({
      where: { organizationId: input.organizationId, userId: input.userId, revokedAt: null },
      data: { revokedAt: input.revokedAt, revocationReason: input.reason },
    });
    return result.count;
  }
}
