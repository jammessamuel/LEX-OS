import { Inject, Injectable, Logger } from '@nestjs/common';
import type { RuntimeConfig } from '@lex-os/config';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import { DatabaseService } from '../database/database.service.js';
import type { ClaimedProcessingJob } from './processing.repository.js';

/**
 * Os avisos que a preparação de documentos dispara (ADR-013).
 *
 * Enfileira na mesma caixa de saída que o convite e a recuperação de senha usam; quem entrega é
 * o despachante, e não este serviço. A separação importa: falhar ao avisar não pode desfazer o
 * registro da falha do documento, que é o fato mais importante dos dois.
 *
 * O e-mail carrega o código interno do caso, o que aconteceu e um link. Nada mais sai daqui —
 * nem título de documento, nem teor extraído, nem a mensagem técnica do erro. Quem clica
 * autentica e vê o resto dentro do sistema, onde tenant, permissão e confidencialidade
 * continuam valendo.
 */
@Injectable()
export class ProcessingNotificationsService {
  readonly #logger = new Logger(ProcessingNotificationsService.name);

  constructor(
    private readonly database: DatabaseService,
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
  ) {}

  /**
   * Documento que não pôde ser preparado, para o responsável pelo caso.
   *
   * Não consulta preferência de aviso, e essa ausência é a regra do ADR-013: é o único aviso
   * que não se desliga, porque documento parado costuma custar prazo processual.
   */
  async documentFailed(job: ClaimedProcessingJob): Promise<void> {
    const responsavel = job.document.case.responsibleUserId;
    if (responsavel === null) {
      return;
    }
    await this.#enqueue(job, responsavel, 'document-failed', {
      caseCode: job.document.case.internalCode,
      link: `${this.config.service.webOrigin}/casos/${job.caseId}`,
    });
  }

  async #enqueue(
    job: ClaimedProcessingJob,
    userId: string,
    templateId: 'document-failed',
    data: Record<string, string>,
  ): Promise<void> {
    try {
      const destinatario = await this.database.client.user.findFirst({
        where: { organizationId: job.organizationId, id: userId, status: 'ACTIVE' },
        select: { email: true, name: true },
      });
      if (destinatario === null) {
        return;
      }
      await this.database.client.emailOutbox.create({
        data: {
          organizationId: job.organizationId,
          userId,
          templateId,
          recipient: destinatario.email,
          payload: { ...data, recipientName: destinatario.name },
        },
        select: { id: true },
      });
    } catch (error) {
      // Falhar ao avisar não pode derrubar o registro da falha do documento: o fato importa
      // mais que o aviso sobre ele. Fica no log com o gatilho e o caso, nunca com o endereço.
      this.#logger.error({
        event: 'notification_enqueue_failed',
        templateId,
        caseId: job.caseId,
        reason: error instanceof Error ? error.name : 'unknown',
      });
    }
  }
}
