import { Module } from '@nestjs/common';

import { RuntimeConfigModule } from '../config/runtime-config.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { EmailDispatcherService } from './email-dispatcher.service.js';
import { EmailOutboxRepository } from './email-outbox.repository.js';
import { EMAIL_PROVIDER, MockEmailProvider } from './email.provider.js';

@Module({
  imports: [RuntimeConfigModule, DatabaseModule],
  providers: [
    EmailOutboxRepository,
    EmailDispatcherService,
    { provide: EMAIL_PROVIDER, useClass: MockEmailProvider },
  ],
  exports: [EmailDispatcherService],
})
export class EmailModule {}
