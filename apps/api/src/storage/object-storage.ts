import type { Readable } from 'node:stream';

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface StoredObjectSummary {
  key: string;
  lastModified: Date;
  sizeBytes: number;
}

export interface PutPrivateObjectInput {
  bucket: string;
  key: string;
  body: Readable;
  contentType: string;
  abortController?: AbortController;
}

export interface CreateDownloadUrlInput {
  bucket: string;
  key: string;
  filename: string;
  contentType: string;
  expiresInSeconds: number;
}

export interface ObjectStorage {
  putPrivateObject(input: PutPrivateObjectInput): Promise<void>;
  deleteObject(bucket: string, key: string): Promise<void>;
  objectExists(bucket: string, key: string): Promise<boolean>;
  listObjects(bucket: string, prefix: string): Promise<StoredObjectSummary[]>;
  createDownloadUrl(input: CreateDownloadUrlInput): Promise<string>;
}
