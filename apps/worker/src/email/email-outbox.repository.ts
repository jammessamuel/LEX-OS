import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class EmailOutboxRepository {
  constructor(private readonly database: DatabaseService) {}

  pending(limit: number) {
    return this.database.client.emailOutbox.findMany({
      where: { status: 'PENDING' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit,
      select: {
        id: true,
        organizationId: true,
        userId: true,
        templateId: true,
        recipient: true,
        payload: true,
        attempts: true,
        user: { select: { name: true } },
      },
    });
  }

  /**
   * Reserva a linha com o estado esperado no `where`. Se dois workers subirem, os dois
   * tentam e só um leva — sem isso, uma pessoa receberia o mesmo convite duas vezes.
   */
  async claim(id: string): Promise<boolean> {
    const result = await this.database.client.emailOutbox.updateMany({
      where: { id, status: 'PENDING' },
      data: { attempts: { increment: 1 } },
    });
    return result.count === 1;
  }

  async markSent(id: string, providerMessageId: string | null): Promise<void> {
    await this.database.client.emailOutbox.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date(), providerMessageId, lastError: null },
    });
  }

  /**
   * Volta para PENDING enquanto houver tentativa; passa a FAILED depois do limite. Falha
   * definitiva não é apagada: a linha é a prova de que alguém não recebeu o que deveria.
   */
  async markAttemptFailed(id: string, attempts: number, max: number, error: string): Promise<void> {
    await this.database.client.emailOutbox.update({
      where: { id },
      data: {
        status: attempts >= max ? 'FAILED' : 'PENDING',
        lastError: error.slice(0, 500),
      },
    });
  }
}
