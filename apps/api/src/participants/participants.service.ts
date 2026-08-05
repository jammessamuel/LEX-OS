import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, withTransaction } from '@lex-os/database';

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
import { PersonsService } from '../persons/persons.service.js';
import type { CreateParticipantRequestDto } from './dto/create-participant-request.dto.js';
import type { ListParticipantsQueryDto } from './dto/list-participants-query.dto.js';
import type { ParticipantResponseDto } from './dto/participant-response.dto.js';
import {
  toDatabaseParticipantSide,
  type ParticipantRoleCode,
  type ParticipantSideCode,
} from './participant.constants.js';
import {
  ParticipantsRepository,
  type ParticipantCursor,
  type ParticipantRecord,
} from './participants.repository.js';

const parseParticipantCursor: (value: unknown) => ParticipantCursor | undefined =
  createTimestampIdCursorParser('createdAt');

function apiSide(value: string | null): ParticipantSideCode | null {
  return value === null ? null : (value.toLowerCase() as ParticipantSideCode);
}

function mapParticipant(record: ParticipantRecord): ParticipantResponseDto {
  return {
    id: record.id,
    caseId: record.caseId,
    role: record.role as ParticipantRoleCode,
    side: apiSide(record.side),
    isClient: record.isClient,
    person: {
      id: record.person.id,
      personType: record.person.personType,
      fullName: record.person.fullName,
      tradeName: record.person.tradeName,
    },
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

@Injectable()
export class ParticipantsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly repository: ParticipantsRepository,
    private readonly cases: CasesService,
    private readonly persons: PersonsService,
    private readonly audit: AuditService,
  ) {}

  async list(
    actor: ActorContext,
    caseId: string,
    query: ListParticipantsQueryDto,
    metadata: RequestAuditMetadata,
  ): Promise<CursorPage<ParticipantResponseDto>> {
    const cursor = decodeCursor(query.cursor, parseParticipantCursor);
    await this.cases.assertAccessibleForParticipants(actor, caseId, metadata, true);
    const rows = await this.repository.list(actor.organizationId, caseId, {
      ...(cursor === undefined ? {} : { cursor }),
      take: query.limit + 1,
    });
    const hasNextPage = rows.length > query.limit;
    const pageRows = hasNextPage ? rows.slice(0, query.limit) : rows;
    const last = pageRows.at(-1);
    return {
      data: pageRows.map(mapParticipant),
      pageInfo: {
        hasNextPage,
        nextCursor:
          hasNextPage && last !== undefined
            ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
            : null,
      },
    };
  }

  async create(
    actor: ActorContext,
    caseId: string,
    input: CreateParticipantRequestDto,
    metadata: RequestAuditMetadata,
  ): Promise<ParticipantResponseDto> {
    await this.cases.assertAccessibleForParticipants(actor, caseId, metadata, false);
    await this.persons.assertAvailable(actor, input.personId);

    try {
      const record = await withTransaction(this.database.client, async (transaction) => {
        const side = toDatabaseParticipantSide(input.side);
        const created = await this.repository.create(transaction, {
          organizationId: actor.organizationId,
          caseId,
          personId: input.personId,
          role: input.role,
          ...(side === undefined ? {} : { side }),
          isClient: input.isClient ?? false,
        });
        await this.audit.recordDomainInTransaction(transaction, {
          organizationId: actor.organizationId,
          userId: actor.userId,
          entityId: created.id,
          entityType: 'case_participant',
          action: 'case_participant.created',
          newData: {
            caseId,
            personId: created.personId,
            role: created.role,
            side: apiSide(created.side),
            isClient: created.isClient,
          },
          ...metadata,
        });
        return created;
      });
      return mapParticipant(record);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ApiException(
            HttpStatus.CONFLICT,
            'PARTICIPANT_ALREADY_EXISTS',
            'Esse participante já está associado ao caso com o papel informado.',
          );
        }
        if (error.code === 'P2003') {
          throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Recurso não encontrado.');
        }
      }
      throw error;
    }
  }
}
