import { Injectable } from '@nestjs/common';
import type { TransactionClient } from '@lex-os/database';

import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class SecondFactorRepository {
  constructor(private readonly database: DatabaseService) {}

  findEnrolment(organizationId: string, userId: string) {
    return this.database.client.user.findFirst({
      where: { id: userId, organizationId, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        totpSecret: true,
        totpActivatedAt: true,
        totpLastStep: true,
        organization: { select: { tradeName: true, requireSecondFactor: true } },
      },
    });
  }

  /**
   * Grava o segredo sem ativar. A ativação é um segundo passo, provado por um código: um
   * segredo que já valesse trancaria do lado de fora quem começa a inscrição e desiste.
   */
  async stageSecret(
    organizationId: string,
    userId: string,
    encryptedSecret: string,
  ): Promise<boolean> {
    const result = await this.database.client.user.updateMany({
      // `totpActivatedAt: null` na cláusula: nunca substituir em silêncio um segredo em uso.
      where: { id: userId, organizationId, deletedAt: null, totpActivatedAt: null },
      data: { totpSecret: encryptedSecret, totpLastStep: null },
    });
    return result.count === 1;
  }

  async activate(
    transaction: TransactionClient,
    input: { organizationId: string; userId: string; activatedAt: Date; step: bigint },
  ): Promise<boolean> {
    const result = await transaction.user.updateMany({
      where: {
        id: input.userId,
        organizationId: input.organizationId,
        totpActivatedAt: null,
        totpSecret: { not: null },
      },
      data: { totpActivatedAt: input.activatedAt, totpLastStep: input.step },
    });
    return result.count === 1;
  }

  /**
   * Registra o passo aceito e recusa a reapresentação do mesmo código: a cláusula exige que o
   * passo guardado seja anterior. Duas requisições com o código interceptado disputam aqui.
   */
  async consumeStep(organizationId: string, userId: string, step: bigint): Promise<boolean> {
    const result = await this.database.client.user.updateMany({
      where: {
        id: userId,
        organizationId,
        OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }],
      },
      data: { totpLastStep: step },
    });
    return result.count === 1;
  }

  async disable(
    transaction: TransactionClient,
    input: { organizationId: string; userId: string },
  ): Promise<void> {
    await transaction.user.updateMany({
      where: { id: input.userId, organizationId: input.organizationId },
      data: { totpSecret: null, totpActivatedAt: null, totpLastStep: null },
    });
    await transaction.totpRecoveryCode.deleteMany({
      where: { organizationId: input.organizationId, userId: input.userId },
    });
  }

  async replaceRecoveryCodes(
    transaction: TransactionClient,
    input: { organizationId: string; userId: string; hashes: readonly string[] },
  ): Promise<void> {
    await transaction.totpRecoveryCode.deleteMany({
      where: { organizationId: input.organizationId, userId: input.userId },
    });
    await transaction.totpRecoveryCode.createMany({
      data: input.hashes.map((codeHash) => ({
        organizationId: input.organizationId,
        userId: input.userId,
        codeHash,
      })),
    });
  }

  /** Gasta um código de recuperação. O estado esperado no `where` garante o uso único. */
  async consumeRecoveryCode(
    organizationId: string,
    userId: string,
    codeHash: string,
    usedAt: Date,
  ): Promise<boolean> {
    const result = await this.database.client.totpRecoveryCode.updateMany({
      where: { organizationId, userId, codeHash, usedAt: null },
      data: { usedAt },
    });
    return result.count === 1;
  }

  countUnusedRecoveryCodes(organizationId: string, userId: string): Promise<number> {
    return this.database.client.totpRecoveryCode.count({
      where: { organizationId, userId, usedAt: null },
    });
  }
}
