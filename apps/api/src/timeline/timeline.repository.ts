import { Injectable } from '@nestjs/common';
import { Prisma, type TransactionClient } from '@lex-os/database';

import { DatabaseService } from '../database/database.service.js';

const timelineEventSelect = {
  id: true,
  organizationId: true,
  caseId: true,
  eventType: true,
  title: true,
  description: true,
  occurredAt: true,
  datePrecision: true,
  importance: true,
  sourceType: true,
  sourceId: true,
  sourceLocator: true,
  confidenceScore: true,
  createdByActorType: true,
  confirmedByUser: true,
  confirmedById: true,
  confirmedAt: true,
  createdAt: true,
  updatedAt: true,
  extraction: {
    select: {
      id: true,
      provider: true,
      modelName: true,
      modelVersion: true,
      promptVersion: true,
      createdAt: true,
    },
  },
} satisfies Prisma.TimelineEventSelect;

export type TimelineEventRecord = Prisma.TimelineEventGetPayload<{
  select: typeof timelineEventSelect;
}>;

export interface TimelineEventCursor {
  createdAt: Date;
  id: string;
}

@Injectable()
export class TimelineRepository {
  constructor(private readonly database: DatabaseService) {}

  list(
    organizationId: string,
    caseId: string,
    cursor: TimelineEventCursor | undefined,
    take: number,
  ): Promise<TimelineEventRecord[]> {
    return this.database.client.timelineEvent.findMany({
      where: {
        organizationId,
        caseId,
        ...(cursor === undefined
          ? {}
          : {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      select: timelineEventSelect,
    });
  }

  findById(organizationId: string, id: string): Promise<TimelineEventRecord | null> {
    return this.database.client.timelineEvent.findFirst({
      where: { id, organizationId },
      select: timelineEventSelect,
    });
  }

  async confirm(
    transaction: TransactionClient,
    organizationId: string,
    id: string,
    userId: string,
    confirmedAt: Date,
  ): Promise<TimelineEventRecord | null> {
    const updated = await transaction.timelineEvent.updateMany({
      where: { id, organizationId, confirmedByUser: false },
      data: { confirmedByUser: true, confirmedById: userId, confirmedAt },
    });
    if (updated.count !== 1) {
      return null;
    }
    return transaction.timelineEvent.findFirst({
      where: { id, organizationId },
      select: timelineEventSelect,
    });
  }
}
