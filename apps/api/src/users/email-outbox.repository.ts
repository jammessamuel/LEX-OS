import { Injectable } from '@nestjs/common';
import type { TransactionClient } from '@lex-os/database';
import type { EmailTemplateId } from '@lex-os/shared';

/**
 * Escrita na caixa de saída.
 *
 * Só o `create`, e só dentro de transação: a intenção de enviar nasce junto com o fato que a
 * origina — não existe convite sem e-mail enfileirado, nem e-mail sem convite. Quem drena é
 * o worker, e ele tem o repositório dele.
 */
@Injectable()
export class EmailOutboxRepository {
  enqueue(
    transaction: TransactionClient,
    input: {
      organizationId: string;
      userId: string;
      templateId: EmailTemplateId;
      recipient: string;
      payload: Record<string, string>;
    },
  ): Promise<{ id: string }> {
    return transaction.emailOutbox.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        templateId: input.templateId,
        recipient: input.recipient,
        payload: input.payload,
      },
      select: { id: true },
    });
  }
}
