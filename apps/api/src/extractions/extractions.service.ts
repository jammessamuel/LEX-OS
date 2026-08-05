import { Injectable } from '@nestjs/common';

import type { RequestAuditMetadata } from '../audit/audit.service.js';
import type { ActorContext } from '../auth/actor-context.js';
import { DocumentsService } from '../documents/documents.service.js';
import { decodeCursor, encodeCursor, type CursorPage } from '../http/pagination.js';
import type { ExtractionResponseDto } from './dto/extraction-response.dto.js';
import type { ListExtractionsQueryDto } from './dto/list-extractions-query.dto.js';
import {
  ExtractionsRepository,
  type ExtractionCursor,
  type ExtractionRecord,
} from './extractions.repository.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function parseCursor(value: unknown): ExtractionCursor | undefined {
  if (value === null || typeof value !== 'object') {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.createdAt !== 'string' ||
    Number.isNaN(Date.parse(candidate.createdAt)) ||
    typeof candidate.id !== 'string' ||
    !uuidPattern.test(candidate.id)
  ) {
    return undefined;
  }
  return { createdAt: new Date(candidate.createdAt), id: candidate.id };
}

function decimal(value: { toNumber(): number } | null): number | null {
  return value?.toNumber() ?? null;
}

function mapExtraction(record: ExtractionRecord): ExtractionResponseDto {
  return {
    id: record.id,
    documentId: record.documentId,
    extractionType: record.extractionType,
    provider: record.provider,
    modelName: record.modelName,
    modelVersion: record.modelVersion,
    executionId: record.executionId,
    status: record.status,
    rawText: record.rawText,
    structuredData: record.structuredData,
    confidenceScore: decimal(record.confidenceScore),
    processingTimeMs: record.processingTimeMs,
    promptVersion: record.promptVersion,
    errorCode: record.errorCode,
    entities: record.extractedEntities.map((entity) => ({
      id: entity.id,
      entityType: entity.entityType,
      normalizedValue: entity.normalizedValue,
      originalValue: entity.originalValue,
      pageNumber: entity.pageNumber,
      startOffset: entity.startOffset,
      endOffset: entity.endOffset,
      confidenceScore: decimal(entity.confidenceScore),
      linkedPersonId: entity.linkedPersonId,
      metadata: entity.metadata,
      createdAt: entity.createdAt.toISOString(),
    })),
    createdAt: record.createdAt.toISOString(),
  };
}

@Injectable()
export class ExtractionsService {
  constructor(
    private readonly documents: DocumentsService,
    private readonly repository: ExtractionsRepository,
  ) {}

  async list(
    actor: ActorContext,
    documentId: string,
    query: ListExtractionsQueryDto,
    metadata: RequestAuditMetadata,
  ): Promise<CursorPage<ExtractionResponseDto>> {
    await this.documents.getProcessingTarget(actor, documentId, metadata);
    const cursor = decodeCursor(query.cursor, parseCursor);
    const rows = await this.repository.list(actor.organizationId, documentId, {
      ...(cursor === undefined ? {} : { cursor }),
      ...(query.extractionType === undefined ? {} : { extractionType: query.extractionType }),
      take: query.limit + 1,
    });
    const hasNextPage = rows.length > query.limit;
    const pageRows = hasNextPage ? rows.slice(0, query.limit) : rows;
    const last = pageRows.at(-1);
    return {
      data: pageRows.map(mapExtraction),
      pageInfo: {
        hasNextPage,
        nextCursor:
          hasNextPage && last !== undefined
            ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
            : null,
      },
    };
  }
}
