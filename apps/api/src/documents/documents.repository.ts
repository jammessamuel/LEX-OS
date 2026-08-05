import { Injectable } from '@nestjs/common';
import { Prisma, type DocumentProcessingStatus, type TransactionClient } from '@lex-os/database';

import { DatabaseService } from '../database/database.service.js';

const documentSelect = {
  id: true,
  organizationId: true,
  caseId: true,
  fileId: true,
  documentTypeId: true,
  title: true,
  description: true,
  documentDate: true,
  issuer: true,
  recipient: true,
  classificationStatus: true,
  processingStatus: true,
  confidenceScore: true,
  isOriginal: true,
  isSigned: true,
  isLegible: true,
  isDuplicate: true,
  classifiedById: true,
  classifiedAt: true,
  createdAt: true,
  updatedAt: true,
  file: {
    select: {
      originalFilename: true,
      mimeType: true,
      extension: true,
      sizeBytes: true,
      virusScanStatus: true,
      status: true,
      duplicateOfFileId: true,
      deletedAt: true,
    },
  },
  documentType: { select: { id: true, code: true, name: true, category: true } },
} satisfies Prisma.DocumentSelect;

export type DocumentRecord = Prisma.DocumentGetPayload<{ select: typeof documentSelect }>;

export interface DocumentCursor {
  createdAt: Date;
  id: string;
}

export interface UpdateDocumentData {
  title?: string;
  description?: string | null;
  documentDate?: Date | null;
  issuer?: string | null;
  recipient?: string | null;
  documentTypeId?: string | null;
  classificationStatus?: 'CLASSIFIED' | 'PENDING';
  classifiedById?: string | null;
  classifiedAt?: Date | null;
  isOriginal?: boolean;
  isSigned?: boolean | null;
  isLegible?: boolean | null;
}

@Injectable()
export class DocumentsRepository {
  constructor(private readonly database: DatabaseService) {}

  list(
    organizationId: string,
    caseId: string,
    input: {
      cursor?: DocumentCursor;
      documentTypeId?: string;
      processingStatus?: DocumentProcessingStatus;
      take: number;
    },
  ): Promise<DocumentRecord[]> {
    const cursorFilter =
      input.cursor === undefined
        ? {}
        : {
            OR: [
              { createdAt: { lt: input.cursor.createdAt } },
              { createdAt: input.cursor.createdAt, id: { lt: input.cursor.id } },
            ],
          };
    return this.database.client.document.findMany({
      where: {
        organizationId,
        caseId,
        deletedAt: null,
        file: { deletedAt: null },
        ...(input.documentTypeId === undefined ? {} : { documentTypeId: input.documentTypeId }),
        ...(input.processingStatus === undefined
          ? {}
          : { processingStatus: input.processingStatus }),
        ...cursorFilter,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.take,
      select: documentSelect,
    });
  }

  findById(organizationId: string, id: string): Promise<DocumentRecord | null> {
    return this.database.client.document.findFirst({
      where: { id, organizationId, deletedAt: null, file: { deletedAt: null } },
      select: documentSelect,
    });
  }

  async documentTypeIsVisible(
    transaction: TransactionClient,
    organizationId: string,
    id: string,
  ): Promise<boolean> {
    const documentType = await transaction.documentType.findFirst({
      where: { id, OR: [{ organizationId: null }, { organizationId }] },
      select: { id: true },
    });
    return documentType !== null;
  }

  async update(
    transaction: TransactionClient,
    organizationId: string,
    id: string,
    data: UpdateDocumentData,
  ): Promise<DocumentRecord | null> {
    const result = await transaction.document.updateMany({
      where: { id, organizationId, deletedAt: null },
      data,
    });
    if (result.count !== 1) {
      return null;
    }
    return transaction.document.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: documentSelect,
    });
  }

  async softDelete(
    transaction: TransactionClient,
    organizationId: string,
    documentId: string,
    fileId: string,
    occurredAt: Date,
  ): Promise<boolean> {
    const result = await transaction.document.updateMany({
      where: { id: documentId, organizationId, deletedAt: null },
      data: { deletedAt: occurredAt },
    });
    if (result.count !== 1) {
      return false;
    }
    const otherDocuments = await transaction.document.count({
      where: { organizationId, fileId, deletedAt: null },
    });
    if (otherDocuments === 0) {
      await transaction.storedFile.updateMany({
        where: { id: fileId, organizationId, deletedAt: null },
        data: { deletedAt: occurredAt },
      });
    }
    return true;
  }
}
