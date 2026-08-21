import { Module } from '@nestjs/common';
import type { RuntimeConfig } from '@lex-os/config';

import { RUNTIME_CONFIG, RuntimeConfigModule } from '../config/runtime-config.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { EmailDispatcherService } from './email-dispatcher.service.js';
import { EmailOutboxRepository } from './email-outbox.repository.js';
import { EMAIL_PROVIDER, MockEmailProvider } from './email.provider.js';
import { SmtpEmailProvider } from './smtp-email.provider.js';

@Module({
  imports: [RuntimeConfigModule, DatabaseModule],
  providers: [
    EmailOutboxRepository,
    EmailDispatcherService,
    {
      provide: EMAIL_PROVIDER,
      /**
       * Em desenvolvimento a mensagem sai de verdade, para o Mailpit: ver o e-mail chegando
       * vale mais que acreditar num teste. Em teste fica o gravador, para a suite nao
       * depender de um servico externo estar de pe. Producao nao chega aqui — os dois
       * adaptadores recusam.
       */
      inject: [RUNTIME_CONFIG],
      useFactory: (config: RuntimeConfig) =>
        config.environment === 'development'
          ? new SmtpEmailProvider(config)
          : new MockEmailProvider(config),
    },
  ],
  exports: [EmailDispatcherService],
})
export class EmailModule {}
