import { Global, Module } from '@nestjs/common';

import { RuntimeConfigModule } from '../config/runtime-config.module.js';
import { DatabaseService } from './database.service.js';

@Global()
@Module({
  imports: [RuntimeConfigModule],
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
