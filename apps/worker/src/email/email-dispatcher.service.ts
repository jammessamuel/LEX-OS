import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { RuntimeConfig } from '@lex-os/config';
import { emailTemplates, type EmailProvider, type EmailTemplateId } from '@lex-os/shared';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import { EmailOutboxRepository } from './email-outbox.repository.js';
import { EMAIL_PROVIDER } from './email.provider.js';

const BATCH = 20;
const MAX_ATTEMPTS = 5;

function isTemplateId(value: string): value is EmailTemplateId {
  return (emailTemplates as readonly string[]).includes(value);
}

function asStringRecord(value: unknown): Record<string, string> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

/**
 * Drena a caixa de saída.
 *
 * Reaproveita o laço periódico do worker em vez de abrir uma fila nova: o volume de e-mail
 * de identidade é baixo — convite e redefinição — e uma fila dedicada custaria uma etapa de
 * infraestrutura sem ganho. Quando houver notificação por evento (ADR-013), isso muda.
 *
 * Nada do corpo entra em log: as linhas registram identificador, modelo e resultado.
 */
@Injectable()
export class EmailDispatcherService implements OnModuleInit, OnModuleDestroy {
  readonly #logger = new Logger(EmailDispatcherService.name);
  #timer: NodeJS.Timeout | undefined;

  constructor(
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
    @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider,
    private readonly repository: EmailOutboxRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.dispatchOnce();
    this.#timer = setInterval(
      () => void this.dispatchOnce().catch((error: unknown) => this.#logFailure(error)),
      this.config.processing.reconcileIntervalSeconds * 1_000,
    );
    this.#timer.unref();
  }

  async dispatchOnce(): Promise<number> {
    const rows = await this.repository.pending(BATCH);
    let delivered = 0;

    for (const row of rows) {
      if (!isTemplateId(row.templateId)) {
        // Modelo desconhecido não é tentado de novo: seria um erro de código, e repetir só
        // enche a trilha. A linha fica com o motivo à vista.
        await this.repository.markAttemptFailed(
          row.id,
          MAX_ATTEMPTS,
          MAX_ATTEMPTS,
          `Unknown e-mail template: ${row.templateId}`,
        );
        continue;
      }
      if (!(await this.repository.claim(row.id))) {
        continue;
      }

      try {
        const result = await this.provider.send({
          templateId: row.templateId,
          recipient: { userId: row.userId, address: row.recipient, name: row.user.name },
          data: asStringRecord(row.payload),
        });
        await this.repository.markSent(row.id, result.providerMessageId);
        delivered += 1;
      } catch (error) {
        await this.repository.markAttemptFailed(
          row.id,
          row.attempts + 1,
          MAX_ATTEMPTS,
          error instanceof Error ? error.message : 'unknown delivery failure',
        );
        this.#logger.warn('email_delivery_failed', {
          outboxId: row.id,
          templateId: row.templateId,
          attempts: row.attempts + 1,
        });
      }
    }

    if (delivered > 0) {
      this.#logger.log('email_outbox_dispatched', { count: delivered });
    }
    return delivered;
  }

  onModuleDestroy(): void {
    if (this.#timer !== undefined) {
      clearInterval(this.#timer);
    }
  }

  #logFailure(error: unknown): void {
    this.#logger.error('email_dispatch_failed', error);
  }
}
