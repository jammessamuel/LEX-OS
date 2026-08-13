import { HttpStatus, Injectable } from '@nestjs/common';

import type { ActorContext } from '../auth/actor-context.js';
import { ApiException } from '../http/api-exception.js';
import { createTimestampIdCursorParser, decodeCursor, encodeCursor } from '../http/pagination.js';
import { AuditRepository, type AuditLogCursor, type AuditLogRecord } from './audit.repository.js';
import { AuditService, type RequestAuditMetadata } from './audit.service.js';
import type { AuditLogListResponseDto } from './dto/audit-log-response.dto.js';
import type { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto.js';

const parseCursor: (value: unknown) => AuditLogCursor | undefined =
  createTimestampIdCursorParser('createdAt');

function mapAuditLog(record: AuditLogRecord) {
  return {
    id: record.id,
    actorType: record.actorType,
    actorId: record.actorId,
    actor: record.user === null ? null : { id: record.user.id, name: record.user.name },
    action: record.action,
    entityType: record.entityType,
    entityId: record.entityId,
    requestId: record.requestId,
    correlationId: record.correlationId,
    processingJobId: record.processingJobId,
    createdAt: record.createdAt.toISOString(),
  };
}

@Injectable()
export class AuditQueryService {
  constructor(
    private readonly repository: AuditRepository,
    private readonly audit: AuditService,
  ) {}

  async list(
    actor: ActorContext,
    query: ListAuditLogsQueryDto,
    metadata: RequestAuditMetadata,
  ): Promise<AuditLogListResponseDto> {
    if (
      query.from !== undefined &&
      query.to !== undefined &&
      new Date(query.from).getTime() > new Date(query.to).getTime()
    ) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'INVALID_AUDIT_DATE_RANGE',
        'A data inicial não pode ser posterior à data final.',
      );
    }

    const cursor = decodeCursor(query.cursor, parseCursor);
    const rows = await this.repository.list(actor.organizationId, {
      ...(cursor === undefined ? {} : { cursor }),
      query,
      take: query.limit + 1,
    });
    const hasNextPage = rows.length > query.limit;
    const pageRows = hasNextPage ? rows.slice(0, query.limit) : rows;
    const last = pageRows.at(-1);

    await this.audit.recordDomain({
      organizationId: actor.organizationId,
      userId: actor.userId,
      entityId: null,
      entityType: 'audit_log',
      action: 'audit.log.listed',
      newData: {
        count: pageRows.length,
        filters: {
          action: query.action ?? null,
          entityType: query.entityType ?? null,
          actorType: query.actorType ?? null,
          userId: query.userId ?? null,
          entityId: query.entityId ?? null,
          from: query.from ?? null,
          to: query.to ?? null,
        },
      },
      ...metadata,
    });

    return {
      data: pageRows.map(mapAuditLog),
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
