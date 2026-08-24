import { Module } from '@nestjs/common';

import { RuntimeConfigModule } from '../config/runtime-config.module.js';
import { OBJECT_WRITER } from './object-writer.js';
import { S3ObjectWriter } from './s3-object-writer.js';

@Module({
  imports: [RuntimeConfigModule],
  providers: [S3ObjectWriter, { provide: OBJECT_WRITER, useExisting: S3ObjectWriter }],
  exports: [OBJECT_WRITER],
})
export class StorageModule {}
