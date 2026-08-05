import { Injectable } from '@nestjs/common';
import { Prisma, type ExtractionType } from '@lex-os/database';

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
      createdAt: true,
    },
  },
} satisfies Prisma.DocumentExtractionSelect;

export type ExtractionRecord = Prisma.DocumentExtractionGetPayload<{
  select: typeof extractionSelect;
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
}
