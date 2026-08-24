import { Inject, Injectable } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { RuntimeConfig } from '@lex-os/config';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import type { ObjectWriter, WriteObjectInput } from './object-writer.js';

@Injectable()
export class S3ObjectWriter implements ObjectWriter {
  readonly #client: S3Client;

  constructor(@Inject(RUNTIME_CONFIG) config: RuntimeConfig) {
    // Endpoint interno: o worker fala com o MinIO pela rede da composição, nunca pelo host
    // público, que só existe para assinar URL de download.
    this.#client = new S3Client({
      endpoint: config.objectStorage.endpoint,
      forcePathStyle: true,
      region: config.objectStorage.region,
      credentials: {
        accessKeyId: config.objectStorage.accessKey,
        secretAccessKey: config.objectStorage.secretKey,
      },
    });
  }

  async writeObject(input: WriteObjectInput): Promise<void> {
    await this.#client.send(
      new PutObjectCommand({
        Bucket: input.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        Metadata: { lifecycle: 'generated' },
      }),
    );
  }
}
