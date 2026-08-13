import { HttpStatus, Injectable } from '@nestjs/common';
import { withTransaction } from '@lex-os/database';

import { AuditService, type RequestAuditMetadata } from '../audit/audit.service.js';
import type { ActorContext } from '../auth/actor-context.js';
import { DatabaseService } from '../database/database.service.js';
import { DocumentsService } from '../documents/documents.service.js';
import { ApiException } from '../http/api-exception.js';
import {
  createTimestampIdCursorParser,
  decodeCursor,
  encodeCursor,
  type CursorPage,
} from '../http/pagination.js';
import type {
  ExtractedEntityResponseDto,
  ExtractionResponseDto,
} from './dto/extraction-response.dto.js';
import type { ListExtractionsQueryDto } from './dto/list-extractions-query.dto.js';
import {
  ExtractionsRepository,
  type ExtractedEntityRecord,
  type ExtractionCursor,
  type ExtractionRecord,
} from './extractions.repository.js';

const parseCursor: (value: unknown) => ExtractionCursor | undefined =
  createTimestampIdCursorParser('createdAt');

function decimal(value: { toNumber(): number } | null): number | null {
  return value?.toNumber() ?? null;
}

type EntityResponseRecord = Omit<
  ExtractedEntityRecord,
  'organizationId' | 'documentId' | 'extractionId'
>;

function mapEntity(entity: EntityResponseRecord): ExtractedEntityResponseDto {
  return {
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
    confirmedByUser: entity.confirmedByUser,
    confirmedById: entity.confirmedById,
    confirmedAt: entity.confirmedAt?.toISOString() ?? null,
    createdAt: entity.createdAt.toISOString(),
  };
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
    entities: record.extractedEntities.map(mapEntity),
    createdAt: record.createdAt.toISOString(),
  };
}

@Injectable()
export class ExtractionsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly documents: DocumentsService,
    private readonly repository: ExtractionsRepository,
    private readonly audit: AuditService,
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

  async confirmEntity(
    actor: ActorContext,
    id: string,
    metadata: RequestAuditMetadata,
  ): Promise<ExtractedEntityResponseDto> {
    const current = await this.repository.findEntityById(actor.organizationId, id);
    if (current === null) {
      throw this.#notFound();
    }
    await this.documents.getProcessingTarget(actor, current.documentId, metadata);
    if (current.confirmedByUser) {
      throw this.#alreadyConfirmed();
    }

    const confirmedAt = new Date();
    const confirmed = await withTransaction(this.database.client, async (transaction) => {
      const result = await this.repository.confirmEntity(
        transaction,
        actor.organizationId,
        id,
        actor.userId,
        confirmedAt,
      );
      if (result === null) {
        throw this.#alreadyConfirmed();
      }
      await this.audit.recordDomainInTransaction(transaction, {
        organizationId: actor.organizationId,
        userId: actor.userId,
        entityId: id,
        entityType: 'extracted_entity',
        action: 'extracted_entity.confirmed',
        oldData: { confirmedByUser: false },
        newData: {
          confirmedByUser: true,
          confirmedById: actor.userId,
          confirmedAt: confirmedAt.toISOString(),
        },
        ...metadata,
      });
      return result;
    });
    return mapEntity(confirmed);
  }

  #alreadyConfirmed(): ApiException {
    return new ApiException(
      HttpStatus.CONFLICT,
      'EXTRACTED_ENTITY_ALREADY_CONFIRMED',
      'A entidade já foi confirmada por uma pessoa.',
    );
  }

  #notFound(): ApiException {
    return new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Recurso não encontrado.');
  }
}
