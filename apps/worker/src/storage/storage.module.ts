import { Module } from '@nestjs/common';

import { RuntimeConfigModule } from '../config/runtime-config.module.js';
import { OBJECT_READER } from './object-reader.js';
import { S3ObjectReader } from './s3-object-reader.js';
import { OBJECT_WRITER } from './object-writer.js';
import { S3ObjectWriter } from './s3-object-writer.js';

@Module({
  imports: [RuntimeConfigModule],
  providers: [
    S3ObjectReader,
    { provide: OBJECT_READER, useExisting: S3ObjectReader },
    S3ObjectWriter,
    { provide: OBJECT_WRITER, useExisting: S3ObjectWriter },
  ],
  exports: [OBJECT_READER, OBJECT_WRITER],
})
export class StorageModule {}
