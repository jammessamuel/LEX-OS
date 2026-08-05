import { Inject, Injectable } from '@nestjs/common';
import type { RuntimeConfig } from '@lex-os/config';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../storage/object-storage.js';
import { FilesRepository } from './files.repository.js';

export interface StorageReconciliationReport {
  organizationId: string;
  checkedAt: string;
  missingObjectFileIds: readonly string[];
  staleQuarantineFileIds: readonly string[];
  orphanObjectCount: number;
}

@Injectable()
export class StorageReconciliationService {
  constructor(
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly files: FilesRepository,
  ) {}

  async report(organizationId: string): Promise<StorageReconciliationReport> {
    const [tenantFiles, allReferences, storedObjects] = await Promise.all([
      this.files.reconciliationFiles(organizationId, 'MINIO'),
      this.files.allActiveStorageKeys('MINIO'),
      this.storage.listObjects(this.config.objectStorage.bucket, 'quarantine/'),
    ]);
    const storedKeys = new Set(storedObjects.map((object) => object.key));
    const referencedKeys = new Set(allReferences.map((reference) => reference.storageKey));
    const staleBefore = Date.now() - this.config.objectStorage.quarantineStaleAfterSeconds * 1_000;

    return {
      organizationId,
      checkedAt: new Date().toISOString(),
      missingObjectFileIds: tenantFiles
        .filter((file) => !storedKeys.has(file.storageKey))
        .map((file) => file.id),
      staleQuarantineFileIds: tenantFiles
        .filter((file) => file.status === 'QUARANTINED' && file.createdAt.getTime() < staleBefore)
        .map((file) => file.id),
      orphanObjectCount: storedObjects.filter((object) => !referencedKeys.has(object.key)).length,
    };
  }
}
