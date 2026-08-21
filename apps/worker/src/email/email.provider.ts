import { Inject, Injectable } from '@nestjs/common';
import type { RuntimeConfig } from '@lex-os/config';
import { RecordingEmailProvider, type EmailProvider } from '@lex-os/shared';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

/**
 * Adaptador determinístico de desenvolvimento e teste.
 *
 * Recusa produção pelo mesmo motivo dos demais mocks: um provedor que aceita a mensagem e não
 * entrega produz silêncio, que é pior que uma falha — ninguém investiga o que não reclamou.
 * O adaptador SMTP de produção entra quando houver relay contratado, e a decisão de qual está
 * em aberto no ADR-014.
 */
@Injectable()
export class MockEmailProvider extends RecordingEmailProvider implements EmailProvider {
  constructor(@Inject(RUNTIME_CONFIG) config: RuntimeConfig) {
    super();
    if (config.environment === 'production') {
      throw new Error('The recording e-mail provider cannot run in production.');
    }
  }
}
