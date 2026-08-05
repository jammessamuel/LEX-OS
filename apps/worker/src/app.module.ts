import { Module } from '@nestjs/common';

import { RuntimeConfigModule } from './config/runtime-config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { ProcessingModule } from './processing/processing.module.js';
import { WorkerService } from './worker.service.js';

@Module({
  imports: [RuntimeConfigModule, DatabaseModule, ProcessingModule],
  providers: [WorkerService],
})
export class AppModule {}
