import { HttpStatus, Injectable } from '@nestjs/common';
import { withTransaction } from '@lex-os/database';

import { AuditService, type RequestAuditMetadata } from '../audit/audit.service.js';
import type { ActorContext } from '../auth/actor-context.js';
import { CasesService } from '../cases/cases.service.js';
import { DatabaseService } from '../database/database.service.js';
import { ApiException } from '../http/api-exception.js';
import {
  createTimestampIdCursorParser,
  decodeCursor,
  encodeCursor,
  type CursorPage,
} from '../http/pagination.js';
import type { ListTimelineEventsQueryDto } from './dto/list-timeline-events-query.dto.js';
import type { TimelineEventResponseDto } from './dto/timeline-event-response.dto.js';
import {
  TimelineRepository,
  type TimelineEventCursor,
  type TimelineEventRecord,
} from './timeline.repository.js';

const parseCursor: (value: unknown) => TimelineEventCursor | undefined =
  createTimestampIdCursorParser('createdAt');

function mapTimelineEvent(record: TimelineEventRecord): TimelineEventResponseDto {
  return {
    id: record.id,
    caseId: record.caseId,
    eventType: record.eventType,
    title: record.title,
    description: record.description,
    occurredAt: record.occurredAt?.toISOString() ?? null,
    datePrecision: record.datePrecision,
    importance: record.importance,
    sourceType: record.sourceType,
    sourceId: record.sourceId,
    sourceLocator:
      record.sourceLocator !== null &&
      typeof record.sourceLocator === 'object' &&
      !Array.isArray(record.sourceLocator)
        ? (record.sourceLocator as Record<string, unknown>)
        : null,
    extraction:
      record.extraction === null
        ? null
        : {
            id: record.extraction.id,
            provider: record.extraction.provider,
            modelName: record.extraction.modelName,
            modelVersion: record.extraction.modelVersion,
            promptVersion: record.extraction.promptVersion,
            createdAt: record.extraction.createdAt.toISOString(),
          },
    confidenceScore:
      record.confidenceScore === null ? null : Number(record.confidenceScore.toString()),
    createdByActorType: record.createdByActorType,
    confirmedByUser: record.confirmedByUser,
    confirmedById: record.confirmedById,
    confirmedAt: record.confirmedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

@Injectable()
export class TimelineService {
  constructor(
    private readonly database: DatabaseService,
    private readonly repository: TimelineRepository,
    private readonly cases: CasesService,
    private readonly audit: AuditService,
  ) {}

  async list(
    actor: ActorContext,
    caseId: string,
    query: ListTimelineEventsQueryDto,
    metadata: RequestAuditMetadata,
  ): Promise<CursorPage<TimelineEventResponseDto>> {
    await this.cases.assertAccessibleForFileResources(actor, caseId, metadata, 'TIMELINE');
    const cursor = decodeCursor(query.cursor, parseCursor);
    const rows = await this.repository.list(actor.organizationId, caseId, cursor, query.limit + 1);
    const hasNextPage = rows.length > query.limit;
    const pageRows = hasNextPage ? rows.slice(0, query.limit) : rows;
    const last = pageRows.at(-1);
    return {
      data: pageRows.map(mapTimelineEvent),
      pageInfo: {
        hasNextPage,
        nextCursor:
          hasNextPage && last !== undefined
            ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
            : null,
      },
    };
  }

  async confirm(
    actor: ActorContext,
    id: string,
    metadata: RequestAuditMetadata,
  ): Promise<TimelineEventResponseDto> {
    const current = await this.repository.findById(actor.organizationId, id);
    if (current === null) {
      throw this.#notFound();
    }
    await this.cases.assertAccessibleForFileResources(actor, current.caseId, metadata, 'TIMELINE');
    if (current.confirmedByUser) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'TIMELINE_EVENT_ALREADY_CONFIRMED',
        'O evento já foi confirmado por uma pessoa.',
      );
    }
    const confirmedAt = new Date();
    const result = await withTransaction(this.database.client, async (transaction) => {
      const confirmed = await this.repository.confirm(
        transaction,
        actor.organizationId,
        id,
        actor.userId,
        confirmedAt,
      );
      if (confirmed === null) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'TIMELINE_EVENT_ALREADY_CONFIRMED',
          'O evento já foi confirmado por uma pessoa.',
        );
      }
      await this.audit.recordDomainInTransaction(transaction, {
        organizationId: actor.organizationId,
        userId: actor.userId,
        entityId: id,
        entityType: 'timeline_event',
        action: 'timeline.event.confirmed',
        oldData: { confirmedByUser: false },
        newData: {
          confirmedByUser: true,
          confirmedById: actor.userId,
          confirmedAt: confirmedAt.toISOString(),
        },
        ...metadata,
      });
      return confirmed;
    });
    return mapTimelineEvent(result);
  }

  #notFound(): ApiException {
    return new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Recurso não encontrado.');
  }
}
