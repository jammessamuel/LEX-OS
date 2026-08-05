import { Injectable } from '@nestjs/common';
import { Prisma, type TransactionClient } from '@lex-os/database';

import { DatabaseService } from '../database/database.service.js';
import type { ParticipantRoleCode, ParticipantSideCode } from './participant.constants.js';

const participantSelect = {
  id: true,
  organizationId: true,
  caseId: true,
  personId: true,
  role: true,
  side: true,
  isClient: true,
  createdAt: true,
  updatedAt: true,
  person: {
    select: { id: true, personType: true, fullName: true, tradeName: true },
  },
} satisfies Prisma.CaseParticipantSelect;

export type ParticipantRecord = Prisma.CaseParticipantGetPayload<{
  select: typeof participantSelect;
}>;

export interface ParticipantCursor {
  createdAt: Date;
  id: string;
}

@Injectable()
export class ParticipantsRepository {
  constructor(private readonly database: DatabaseService) {}

  list(
    organizationId: string,
    caseId: string,
    input: { cursor?: ParticipantCursor; take: number },
  ): Promise<ParticipantRecord[]> {
    const cursorFilter =
      input.cursor === undefined
        ? {}
        : {
            OR: [
              { createdAt: { gt: input.cursor.createdAt } },
              { createdAt: input.cursor.createdAt, id: { gt: input.cursor.id } },
            ],
          };
    return this.database.client.caseParticipant.findMany({
      where: { organizationId, caseId, person: { deletedAt: null }, ...cursorFilter },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: input.take,
      select: participantSelect,
    });
  }

  create(
    transaction: TransactionClient,
    data: {
      organizationId: string;
      caseId: string;
      personId: string;
      role: ParticipantRoleCode;
      side?: Uppercase<ParticipantSideCode>;
      isClient: boolean;
    },
  ): Promise<ParticipantRecord> {
    return transaction.caseParticipant.create({ data, select: participantSelect });
  }
}
