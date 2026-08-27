import { Inject, Injectable, Logger } from '@nestjs/common';
import type { RuntimeConfig } from '@lex-os/config';
import { withTransaction, type TransactionClient } from '@lex-os/database';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import { DatabaseService } from '../database/database.service.js';

/**
 * O aviso de tarefa atribuída (ADR-013).
 *
 * Vai só a quem recebeu a tarefa, e só quando é outra pessoa: atribuir uma tarefa a si mesmo é
 * um ato que a própria pessoa acabou de fazer, e avisá-la disso é ruído.
 *
 * O e-mail carrega o código interno do caso, o que aconteceu e um link. Não carrega o título da
 * tarefa — título de tarefa em caso jurídico costuma descrever a peça que falta, que é
 * exatamente o tipo de coisa que não deve viajar por e-mail.
 */
@Injectable()
export class TaskNotificationsService {
  readonly #logger = new Logger(TaskNotificationsService.name);

  constructor(
    private readonly database: DatabaseService,
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
  ) {}

  /**
   * Enfileira o aviso, fora da transação que criou a tarefa.
   *
   * A tarefa existir importa mais que o aviso sobre ela: enfileirar dentro da transação faria
   * uma falha de e-mail desfazer a criação, que é o oposto da prioridade certa.
   */
  async taskAssigned(input: {
    organizationId: string;
    assignedToId: string | null;
    assignedById: string;
    caseId: string;
    taskId: string;
  }): Promise<void> {
    if (input.assignedToId === null || input.assignedToId === input.assignedById) {
      return;
    }
    try {
      await withTransaction(this.database.client, async (transaction) => {
        const destinatario = await this.#recipient(
          transaction,
          input.organizationId,
          input.assignedToId as string,
        );
        if (destinatario === null) {
          return;
        }
        const legalCase = await transaction.case.findFirst({
          where: { organizationId: input.organizationId, id: input.caseId, deletedAt: null },
          select: { internalCode: true },
        });
        if (legalCase === null) {
          return;
        }
        await transaction.emailOutbox.create({
          data: {
            organizationId: input.organizationId,
            userId: input.assignedToId as string,
            templateId: 'task-assigned',
            recipient: destinatario.email,
            payload: {
              recipientName: destinatario.name,
              caseCode: legalCase.internalCode,
              link: `${this.config.service.webOrigin}/casos/${input.caseId}/tarefas`,
            },
          },
          select: { id: true },
        });
      });
    } catch (error) {
      // O log registra o gatilho e o caso, nunca o endereço nem o título da tarefa.
      this.#logger.error({
        event: 'notification_enqueue_failed',
        templateId: 'task-assigned',
        caseId: input.caseId,
        reason: error instanceof Error ? error.name : 'unknown',
      });
    }
  }

  /**
   * A pessoa, se ela estiver ativa e não tiver desligado este aviso.
   *
   * Diferente da falha de documento, este se silencia — e por isso aqui há consulta de
   * preferência, e lá não há.
   */
  async #recipient(
    transaction: TransactionClient,
    organizationId: string,
    userId: string,
  ): Promise<{ email: string; name: string } | null> {
    const user = await transaction.user.findFirst({
      where: { organizationId, id: userId, status: 'ACTIVE' },
      select: { email: true, name: true, silencedNotifications: true },
    });
    if (user === null || user.silencedNotifications.includes('task-assigned')) {
      return null;
    }
    return { email: user.email, name: user.name };
  }
}
