import { Inject, Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { RuntimeConfig } from '@lex-os/config';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import type {
  CreateDownloadUrlInput,
  ObjectStorage,
  PutPrivateObjectInput,
  StoredObjectSummary,
} from './object-storage.js';

const FIVE_MEBIBYTES = 5 * 1_024 * 1_024;

function client(config: RuntimeConfig, endpoint: string): S3Client {
  return new S3Client({
    endpoint,
    forcePathStyle: true,
    region: config.objectStorage.region,
    credentials: {
      accessKeyId: config.objectStorage.accessKey,
      secretAccessKey: config.objectStorage.secretKey,
    },
  });
}

function contentDisposition(filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/gu, '_').replace(/["\\]/gu, '_');
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

@Injectable()
export class S3ObjectStorage implements ObjectStorage {
  readonly #internalClient: S3Client;
  readonly #publicSigningClient: S3Client;

  constructor(@Inject(RUNTIME_CONFIG) config: RuntimeConfig) {
    this.#internalClient = client(config, config.objectStorage.endpoint);
    this.#publicSigningClient = client(config, config.objectStorage.publicEndpoint);
  }

  async putPrivateObject(input: PutPrivateObjectInput): Promise<void> {
    const upload = new Upload({
      client: this.#internalClient,
      params: {
        Bucket: input.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        Metadata: { lifecycle: 'quarantine' },
      },
      ...(input.abortController === undefined ? {} : { abortController: input.abortController }),
      queueSize: 1,
      partSize: FIVE_MEBIBYTES,
      leavePartsOnError: false,
    });
    await upload.done();
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    await this.#internalClient.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }

  async objectExists(bucket: string, key: string): Promise<boolean> {
    try {
      await this.#internalClient.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return true;
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.name === 'NotFound' || error.name === 'NoSuchKey' || error.name === 'NoSuchObject')
      ) {
        return false;
      }
      throw error;
    }
  }

  async listObjects(bucket: string, prefix: string): Promise<StoredObjectSummary[]> {
    const objects: StoredObjectSummary[] = [];
    let continuationToken: string | undefined;

    do {
      const result = await this.#internalClient.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ...(continuationToken === undefined ? {} : { ContinuationToken: continuationToken }),
        }),
      );
      for (const object of result.Contents ?? []) {
        if (object.Key !== undefined && object.LastModified !== undefined) {
          objects.push({
            key: object.Key,
            lastModified: object.LastModified,
            sizeBytes: object.Size ?? 0,
          });
        }
      }
      continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
    } while (continuationToken !== undefined);

    return objects;
  }

  createDownloadUrl(input: CreateDownloadUrlInput): Promise<string> {
    return getSignedUrl(
      this.#publicSigningClient,
      new GetObjectCommand({
        Bucket: input.bucket,
        Key: input.key,
        ResponseContentType: input.contentType,
        ResponseContentDisposition: contentDisposition(input.filename),
      }),
      { expiresIn: input.expiresInSeconds },
    );
  }
}
