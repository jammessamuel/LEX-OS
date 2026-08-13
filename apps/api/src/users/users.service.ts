import { Injectable } from '@nestjs/common';

import { AuditService, type RequestAuditMetadata } from '../audit/audit.service.js';
import type { ActorContext } from '../auth/actor-context.js';
import { createTimestampIdCursorParser, decodeCursor, encodeCursor } from '../http/pagination.js';
import type { AssignableUserListResponseDto } from './dto/assignable-user-response.dto.js';
import type { ListAssignableUsersQueryDto } from './dto/list-assignable-users-query.dto.js';
import {
  UsersRepository,
  type AssignableUserCursor,
  type AssignableUserRecord,
} from './users.repository.js';

const parseCursor: (value: unknown) => AssignableUserCursor | undefined =
  createTimestampIdCursorParser('createdAt');

function mapAssignableUser(record: AssignableUserRecord) {
  return { id: record.id, name: record.name };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly repository: UsersRepository,
    private readonly audit: AuditService,
  ) {}

  async listAssignable(
    actor: ActorContext,
    query: ListAssignableUsersQueryDto,
    metadata: RequestAuditMetadata,
  ): Promise<AssignableUserListResponseDto> {
    const cursor = decodeCursor(query.cursor, parseCursor);
    const rows = await this.repository.listAssignable(actor.organizationId, {
      ...(cursor === undefined ? {} : { cursor }),
      take: query.limit + 1,
    });
    const hasNextPage = rows.length > query.limit;
    const pageRows = hasNextPage ? rows.slice(0, query.limit) : rows;
    const last = pageRows.at(-1);

    await this.audit.recordDomain({
      organizationId: actor.organizationId,
      userId: actor.userId,
      entityId: null,
      entityType: 'user',
      action: 'user.assignable.listed',
      newData: { count: pageRows.length },
      ...metadata,
    });

    return {
      data: pageRows.map(mapAssignableUser),
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
