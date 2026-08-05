import { Injectable } from '@nestjs/common';
import type { TransactionClient } from '@lex-os/database';

import { DatabaseService } from '../database/database.service.js';

const loginUserSelect = {
  id: true,
  organizationId: true,
  name: true,
  email: true,
  passwordHash: true,
  status: true,
  deletedAt: true,
  organization: {
    select: {
      id: true,
      tradeName: true,
      status: true,
      deletedAt: true,
    },
  },
} as const;

const refreshSessionSelect = {
  id: true,
  organizationId: true,
  userId: true,
  tokenFamilyId: true,
  expiresAt: true,
  rotatedAt: true,
  revokedAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      deletedAt: true,
    },
  },
  organization: {
    select: {
      id: true,
      tradeName: true,
      status: true,
      deletedAt: true,
    },
  },
} as const;

@Injectable()
export class AuthRepository {
  constructor(private readonly database: DatabaseService) {}

  findLoginUser(organizationId: string, email: string) {
    return this.database.client.user.findUnique({
      where: { organizationId_email: { organizationId, email } },
      select: loginUserSelect,
    });
  }

  async markSuccessfulLogin(
    transaction: TransactionClient,
    organizationId: string,
    userId: string,
    occurredAt: Date,
  ): Promise<boolean> {
    const result = await transaction.user.updateMany({
      where: {
        id: userId,
        organizationId,
        status: 'ACTIVE',
        deletedAt: null,
        organization: { status: 'ACTIVE', deletedAt: null },
      },
      data: { lastLoginAt: occurredAt },
    });
    return result.count === 1;
  }

  createRefreshSession(
    transaction: TransactionClient,
    input: {
      id: string;
      organizationId: string;
      userId: string;
      tokenFamilyId: string;
      tokenHash: string;
      expiresAt: Date;
    },
  ) {
    return transaction.refreshSession.create({ data: input });
  }

  findRefreshSessionByHash(transaction: TransactionClient, tokenHash: string) {
    return transaction.refreshSession.findUnique({
      where: { tokenHash },
      select: refreshSessionSelect,
    });
  }

  async markRefreshSessionRotated(
    transaction: TransactionClient,
    sessionId: string,
    occurredAt: Date,
  ): Promise<boolean> {
    const result = await transaction.refreshSession.updateMany({
      where: {
        id: sessionId,
        rotatedAt: null,
        revokedAt: null,
        expiresAt: { gt: occurredAt },
      },
      data: { rotatedAt: occurredAt },
    });
    return result.count === 1;
  }

  revokeTokenFamily(
    transaction: TransactionClient,
    tokenFamilyId: string,
    occurredAt: Date,
    reason: string,
  ) {
    return transaction.refreshSession.updateMany({
      where: { tokenFamilyId, revokedAt: null },
      data: { revokedAt: occurredAt, revocationReason: reason },
    });
  }

  findActorSession(sessionId: string) {
    return this.database.client.refreshSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        organizationId: true,
        userId: true,
        expiresAt: true,
        revokedAt: true,
        user: {
          select: {
            status: true,
            deletedAt: true,
            userRoles: {
              select: {
                role: {
                  select: {
                    organizationId: true,
                    rolePermissions: {
                      select: { permission: { select: { code: true } } },
                    },
                  },
                },
              },
            },
          },
        },
        organization: { select: { status: true, deletedAt: true } },
      },
    });
  }

  findSessionForLogout(
    transaction: TransactionClient,
    sessionId: string,
    organizationId: string,
    userId: string,
  ) {
    return transaction.refreshSession.findFirst({
      where: { id: sessionId, organizationId, userId },
      select: { id: true, tokenFamilyId: true },
    });
  }
}
