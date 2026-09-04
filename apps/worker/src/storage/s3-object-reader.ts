import { Inject, Injectable } from '@nestjs/common';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { RuntimeConfig } from '@lex-os/config';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import type { ObjectReader, ReadObjectInput, ReadObjectResult } from './object-reader.js';

/**
 * Lê até o teto e usa um único byte adicional para provar se houve corte.
 *
 * Comparar apenas o tamanho do último bloco não basta: o bloco pode terminar exatamente no teto
 * e ainda existir conteúdo depois dele. O byte de prova mantém a memória limitada e não depende
 * do tamanho dos blocos escolhido pelo cliente S3.
 */
export async function readBodyAtMost(
  stream: AsyncIterable<Uint8Array>,
  maxBytes: number,
): Promise<ReadObjectResult> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || !Number.isSafeInteger(maxBytes + 1)) {
    throw new Error('The object read limit must be a positive safe integer.');
  }

  const proofLimit = maxBytes + 1;
  const parts: Buffer[] = [];
  let bytesRead = 0;

  for await (const chunk of stream) {
    const remaining = proofLimit - bytesRead;
    const accepted = chunk.subarray(0, remaining);
    if (accepted.length > 0) {
      parts.push(Buffer.from(accepted));
      bytesRead += accepted.length;
    }
    if (bytesRead === proofLimit) {
      break;
    }
  }

  const read = Buffer.concat(parts, bytesRead);
  return {
    body: read.subarray(0, maxBytes),
    truncated: read.length > maxBytes,
  };
}

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

    return readBodyAtMost(stream as AsyncIterable<Uint8Array>, input.maxBytes);
  }
}
