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

/**
 * A posição na cronologia, que é a data do fato — não a de quando a linha foi gravada.
 *
 * `occurredAt` é anulável: evento pode existir sem data determinável, e a interface o mostra
 * como "Data não identificada". Sem data ele não tem lugar na sequência, então vai para o fim,
 * e o cursor precisa saber em qual das duas metades está.
 */
export interface TimelineEventCursor {
  occurredAt: Date | null;
  id: string;
}

/**
 * O que vem depois do cursor, numa ordenação ascendente com os sem data no fim.
 *
 * Sem data, o evento está na metade final: dali em diante só há outros sem data, desempatados
 * pelo identificador. Com data, vem quem tem data maior, quem tem a mesma data e identificador
 * maior, e todos os sem data — que sortam depois de qualquer data.
 */
function afterCursor(cursor: TimelineEventCursor): Prisma.TimelineEventWhereInput {
  if (cursor.occurredAt === null) {
    return { occurredAt: null, id: { gt: cursor.id } };
  }
  return {
    OR: [
      { occurredAt: { gt: cursor.occurredAt } },
      { occurredAt: cursor.occurredAt, id: { gt: cursor.id } },
      { occurredAt: null },
    ],
  };
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
        ...(cursor === undefined ? {} : afterCursor(cursor)),
      },
      // A tela promete "na ordem dos fatos" e a consulta entregava a ordem da gravação: com
      // todos os eventos processados no mesmo minuto, a lista saía agrupada por documento, e a
      // admissão de 2020 aparecia depois da rescisão de 2026. Cronologia fora de ordem não é
      // cronologia. O índice `[organizationId, caseId, occurredAt]` já existia para isto.
      orderBy: [{ occurredAt: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
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
