import { Injectable } from '@nestjs/common';
import { Prisma } from '@lex-os/database';

import { DatabaseService } from '../database/database.service.js';
import type { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto.js';

const auditLogSelect = {
  id: true,
  actorType: true,
  actorId: true,
  action: true,
  entityType: true,
  entityId: true,
  requestId: true,
  correlationId: true,
  processingJobId: true,
  createdAt: true,
  user: { select: { id: true, name: true } },
} satisfies Prisma.AuditLogSelect;

export type AuditLogRecord = Prisma.AuditLogGetPayload<{ select: typeof auditLogSelect }>;

export interface AuditLogCursor {
  createdAt: Date;
  id: string;
}

@Injectable()
export class AuditRepository {
  constructor(private readonly database: DatabaseService) {}

  list(
    organizationId: string,
    input: {
      cursor?: AuditLogCursor;
      query: ListAuditLogsQueryDto;
      take: number;
    },
  ): Promise<AuditLogRecord[]> {
    const { query } = input;
    return this.database.client.auditLog.findMany({
      where: {
        organizationId,
        ...(query.action === undefined ? {} : { action: query.action }),
        ...(query.entityType === undefined ? {} : { entityType: query.entityType }),
        ...(query.actorType === undefined ? {} : { actorType: query.actorType }),
        ...(query.userId === undefined ? {} : { userId: query.userId }),
        ...(query.entityId === undefined ? {} : { entityId: query.entityId }),
        ...(query.from === undefined && query.to === undefined
          ? {}
          : {
              createdAt: {
                ...(query.from === undefined ? {} : { gte: new Date(query.from) }),
                ...(query.to === undefined ? {} : { lte: new Date(query.to) }),
              },
            }),
        ...(input.cursor === undefined
          ? {}
          : {
              OR: [
                { createdAt: { lt: input.cursor.createdAt } },
                { createdAt: input.cursor.createdAt, id: { lt: input.cursor.id } },
              ],
            }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.take,
      select: auditLogSelect,
    });
  }
}
