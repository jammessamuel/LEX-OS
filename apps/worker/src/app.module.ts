import { Module } from '@nestjs/common';

import { RuntimeConfigModule } from './config/runtime-config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { EmailModule } from './email/email.module.js';
import { ExportModule } from './export/export.module.js';
import { ProcessingModule } from './processing/processing.module.js';
import { WorkerService } from './worker.service.js';

@Module({
  imports: [RuntimeConfigModule, DatabaseModule, ProcessingModule, EmailModule, ExportModule],
  providers: [WorkerService],
})
export class AppModule {}
