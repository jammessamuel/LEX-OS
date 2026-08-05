import { Injectable } from '@nestjs/common';
import { Prisma, type TransactionClient } from '@lex-os/database';

import { DatabaseService } from '../database/database.service.js';

const fileSelect = {
  id: true,
  organizationId: true,
  storageProvider: true,
  storageBucket: true,
  storageKey: true,
  originalFilename: true,
  mimeType: true,
  extension: true,
  sizeBytes: true,
  checksumSha256: true,
  uploadedById: true,
  uploadSource: true,
  virusScanStatus: true,
  status: true,
  duplicateOfFileId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.StoredFileSelect;

const fileListSelect = {
  ...fileSelect,
  documents: {
    where: { deletedAt: null },
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
    take: 1,
    select: { id: true, caseId: true },
  },
} satisfies Prisma.StoredFileSelect;

const downloadSelect = {
  ...fileSelect,
  documents: {
    where: { deletedAt: null },
    select: {
      id: true,
      caseId: true,
      case: { select: { id: true, confidentialityLevel: true, deletedAt: true } },
    },
  },
} satisfies Prisma.StoredFileSelect;

export type StoredFileRecord = Prisma.StoredFileGetPayload<{ select: typeof fileSelect }>;
export type StoredFileListRecord = Prisma.StoredFileGetPayload<{ select: typeof fileListSelect }>;
export type DownloadableFileRecord = Prisma.StoredFileGetPayload<{ select: typeof downloadSelect }>;

export interface FileCursor {
  createdAt: Date;
  id: string;
}

export interface CreateIntakeResourcesInput {
  organizationId: string;
  caseId: string;
  uploadedById: string;
  storageProvider: string;
  storageBucket: string;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  checksumSha256: string;
  virusScanStatus: 'CLEAN' | 'ERROR';
  fileStatus: 'AVAILABLE' | 'QUARANTINED';
  documentTitle: string;
  jobType: 'FILE_VALIDATION' | 'VIRUS_SCAN';
}

export interface CreatedIntakeResources {
  file: StoredFileRecord;
  document: { id: string; caseId: string; processingStatus: string; isDuplicate: boolean };
  job: {
    id: string;
    jobType: CreateIntakeResourcesInput['jobType'];
    status: string;
  };
}

export interface ReconciliationFileRecord {
  id: string;
  storageKey: string;
  status: string;
  createdAt: Date;
}

@Injectable()
export class FilesRepository {
  constructor(private readonly database: DatabaseService) {}

  list(
    organizationId: string,
    caseId: string,
    input: { cursor?: FileCursor; take: number },
  ): Promise<StoredFileListRecord[]> {
    const cursorFilter =
      input.cursor === undefined
        ? {}
        : {
            OR: [
              { createdAt: { lt: input.cursor.createdAt } },
              { createdAt: input.cursor.createdAt, id: { lt: input.cursor.id } },
            ],
          };

    return this.database.client.storedFile.findMany({
      where: {
        organizationId,
        deletedAt: null,
        documents: { some: { organizationId, caseId, deletedAt: null } },
        ...cursorFilter,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.take,
      select: fileListSelect,
    });
  }

  findForDownload(organizationId: string, id: string): Promise<DownloadableFileRecord | null> {
    return this.database.client.storedFile.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: downloadSelect,
    });
  }

  async createIntakeResources(
    transaction: TransactionClient,
    input: CreateIntakeResourcesInput,
  ): Promise<CreatedIntakeResources> {
    await transaction.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${input.organizationId}:${input.checksumSha256}`}, 0))`,
    );
    const duplicate = await transaction.storedFile.findFirst({
      where: {
        organizationId: input.organizationId,
        checksumSha256: input.checksumSha256,
        sizeBytes: input.sizeBytes,
        status: 'AVAILABLE',
        virusScanStatus: 'CLEAN',
        deletedAt: null,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    const file = await transaction.storedFile.create({
      data: {
        organizationId: input.organizationId,
        storageProvider: input.storageProvider,
        storageBucket: input.storageBucket,
        storageKey: input.storageKey,
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
        extension: input.extension,
        sizeBytes: input.sizeBytes,
        checksumSha256: input.checksumSha256,
        uploadedById: input.uploadedById,
        uploadSource: 'HTTP_MULTIPART',
        virusScanStatus: input.virusScanStatus,
        status: input.fileStatus,
        duplicateOfFileId: duplicate?.id ?? null,
      },
      select: fileSelect,
    });
    const document = await transaction.document.create({
      data: {
        organizationId: input.organizationId,
        caseId: input.caseId,
        fileId: file.id,
        title: input.documentTitle,
        classificationStatus: 'PENDING',
        processingStatus: 'QUEUED',
        isDuplicate: duplicate !== null,
      },
      select: { id: true, caseId: true, processingStatus: true, isDuplicate: true },
    });
    if (document.caseId === null) {
      throw new Error('An intake document must retain its case relationship.');
    }
    const job = await transaction.processingJob.create({
      data: {
        organizationId: input.organizationId,
        caseId: input.caseId,
        fileId: file.id,
        documentId: document.id,
        jobType: input.jobType,
        status: 'QUEUED',
        inputMetadata: {
          source: 'HTTP_MULTIPART',
          ...(input.jobType === 'VIRUS_SCAN' ? { scannerRetryRequired: true } : {}),
        },
      },
      select: { id: true, jobType: true, status: true },
    });
    return {
      file,
      document: { ...document, caseId: document.caseId },
      job: { id: job.id, jobType: input.jobType, status: job.status },
    };
  }

  reconciliationFiles(
    organizationId: string,
    storageProvider: string,
  ): Promise<ReconciliationFileRecord[]> {
    return this.database.client.storedFile.findMany({
      where: {
        organizationId,
        storageProvider,
        deletedAt: null,
        status: { in: ['AVAILABLE', 'QUARANTINED'] },
      },
      select: { id: true, storageKey: true, status: true, createdAt: true },
    });
  }

  allActiveStorageKeys(storageProvider: string): Promise<{ storageKey: string }[]> {
    return this.database.client.storedFile.findMany({
      where: {
        storageProvider,
        deletedAt: null,
        status: { in: ['AVAILABLE', 'QUARANTINED'] },
      },
      select: { storageKey: true },
    });
  }
}
