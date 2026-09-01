import { Inject, Injectable } from '@nestjs/common';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { RuntimeConfig } from '@lex-os/config';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import type { ObjectReader, ReadObjectInput, ReadObjectResult } from './object-reader.js';

@Injectable()
export class S3ObjectReader implements ObjectReader {
  readonly #client: S3Client;

  constructor(@Inject(RUNTIME_CONFIG) config: RuntimeConfig) {
    // Endpoint interno, como no escritor: o worker fala com o armazenamento pela rede da
    // composição, nunca pelo host público, que só existe para assinar URL de download.
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

  /**
   * Lê o objeto, parando no teto.
   *
   * O corte acontece durante o fluxo e não depois: carregar um arquivo de vinte e cinco
   * megabytes na memória para descartar a maior parte dele deixaria o worker refém do maior
   * upload que alguém fizer.
   */
  async readObject(input: ReadObjectInput): Promise<ReadObjectResult> {
    const response = await this.#client.send(
      new GetObjectCommand({ Bucket: input.bucket, Key: input.key }),
    );
    const stream = response.Body;
    if (stream === undefined) {
      throw new Error('The stored object has no body.');
    }

    const partes: Buffer[] = [];
    let lidos = 0;
    let truncated = false;
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      const restante = input.maxBytes - lidos;
      if (chunk.length >= restante) {
        partes.push(Buffer.from(chunk.subarray(0, restante)));
        truncated = chunk.length > restante;
        break;
      }
      partes.push(Buffer.from(chunk));
      lidos += chunk.length;
    }
    return { body: Buffer.concat(partes), truncated };
  }
}
