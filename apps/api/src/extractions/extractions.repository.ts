import { Injectable } from '@nestjs/common';
import { Prisma, type ExtractionType, type TransactionClient } from '@lex-os/database';

import { DatabaseService } from '../database/database.service.js';

const extractionSelect = {
  id: true,
  documentId: true,
  extractionType: true,
  provider: true,
  modelName: true,
  modelVersion: true,
  executionId: true,
  status: true,
  rawText: true,
  structuredData: true,
  confidenceScore: true,
  processingTimeMs: true,
  promptVersion: true,
  errorCode: true,
  createdAt: true,
  extractedEntities: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      entityType: true,
      normalizedValue: true,
      originalValue: true,
      pageNumber: true,
      startOffset: true,
      endOffset: true,
      confidenceScore: true,
      linkedPersonId: true,
      metadata: true,
      confirmedByUser: true,
      confirmedById: true,
      confirmedAt: true,
      createdAt: true,
    },
  },
} satisfies Prisma.DocumentExtractionSelect;

export type ExtractionRecord = Prisma.DocumentExtractionGetPayload<{
  select: typeof extractionSelect;
}>;

const extractedEntitySelect = {
  id: true,
  organizationId: true,
  documentId: true,
  extractionId: true,
  entityType: true,
  normalizedValue: true,
  originalValue: true,
  pageNumber: true,
  startOffset: true,
  endOffset: true,
  confidenceScore: true,
  linkedPersonId: true,
  metadata: true,
  confirmedByUser: true,
  confirmedById: true,
  confirmedAt: true,
  createdAt: true,
} satisfies Prisma.ExtractedEntitySelect;

export type ExtractedEntityRecord = Prisma.ExtractedEntityGetPayload<{
  select: typeof extractedEntitySelect;
}>;

export interface ExtractionCursor {
  createdAt: Date;
  id: string;
}

@Injectable()
export class ExtractionsRepository {
  constructor(private readonly database: DatabaseService) {}

  list(
    organizationId: string,
    documentId: string,
    input: { cursor?: ExtractionCursor; extractionType?: ExtractionType; take: number },
  ): Promise<ExtractionRecord[]> {
    const cursorFilter =
      input.cursor === undefined
        ? {}
        : {
            OR: [
              { createdAt: { lt: input.cursor.createdAt } },
              { createdAt: input.cursor.createdAt, id: { lt: input.cursor.id } },
            ],
          };
    return this.database.client.documentExtraction.findMany({
      where: {
        organizationId,
        documentId,
        ...(input.extractionType === undefined ? {} : { extractionType: input.extractionType }),
        ...cursorFilter,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.take,
      select: extractionSelect,
    });
  }

  findEntityById(organizationId: string, id: string): Promise<ExtractedEntityRecord | null> {
    return this.database.client.extractedEntity.findFirst({
      where: { organizationId, id },
      select: extractedEntitySelect,
    });
  }

  async confirmEntity(
    transaction: TransactionClient,
    organizationId: string,
    id: string,
    userId: string,
    confirmedAt: Date,
  ): Promise<ExtractedEntityRecord | null> {
    const updated = await transaction.extractedEntity.updateMany({
      where: { organizationId, id, confirmedByUser: false },
      data: { confirmedByUser: true, confirmedById: userId, confirmedAt },
    });
    if (updated.count !== 1) {
      return null;
    }
    return transaction.extractedEntity.findFirst({
      where: { organizationId, id },
      select: extractedEntitySelect,
    });
  }
}
