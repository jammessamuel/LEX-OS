import { HttpStatus, Injectable } from '@nestjs/common';
import { withTransaction } from '@lex-os/database';

import { AuditService, type RequestAuditMetadata } from '../audit/audit.service.js';
import type { ActorContext } from '../auth/actor-context.js';
import { DatabaseService } from '../database/database.service.js';
import { ApiException } from '../http/api-exception.js';
import { createTimestampIdCursorParser, decodeCursor, encodeCursor } from '../http/pagination.js';
import type { AssignableUserListResponseDto } from './dto/assignable-user-response.dto.js';
import type { ListAssignableUsersQueryDto } from './dto/list-assignable-users-query.dto.js';
import { RoleGrantService } from './role-grant.service.js';
import {
  UsersRepository,
  type AssignableUserCursor,
  type AssignableUserRecord,
  type ManagedUserRecord,
} from './users.repository.js';

const parseCursor: (value: unknown) => AssignableUserCursor | undefined =
  createTimestampIdCursorParser('createdAt');

function mapAssignableUser(record: AssignableUserRecord) {
  return { id: record.id, name: record.name };
}

function mapManagedUser(record: ManagedUserRecord) {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    status: record.status,
    lastLoginAt: record.lastLoginAt?.toISOString() ?? null,
    roles: record.userRoles.map((entry) => entry.role),
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly repository: UsersRepository,
    private readonly audit: AuditService,
    private readonly grants: RoleGrantService,
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

  async listManaged(
    actor: ActorContext,
    query: ListAssignableUsersQueryDto,
    metadata: RequestAuditMetadata,
  ) {
    const cursor = decodeCursor(query.cursor, parseCursor);
    const rows = await this.repository.listManaged(actor.organizationId, {
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
      action: 'user.listed',
      newData: { count: pageRows.length },
      ...metadata,
    });

    return {
      data: pageRows.map(mapManagedUser),
      pageInfo: {
        hasNextPage,
        nextCursor:
          hasNextPage && last !== undefined
            ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
            : null,
      },
    };
  }

  async replaceRoles(
    actor: ActorContext,
    userId: string,
    roleIds: readonly string[],
    metadata: RequestAuditMetadata,
  ) {
    const target = await this.#requireUser(actor, userId);
    const unique = [...new Set(roleIds)];
    await this.grants.assertGrantable(actor.organizationId, actor.userId, unique);

    // Ninguém remove o próprio acesso administrativo. Sem isso, o último administrador se
    // tranca do lado de fora e só sai de lá por intervenção nossa — ver ADR-014, item 8.
    if (target.id === actor.userId) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'CANNOT_CHANGE_OWN_ROLES',
        'Você não pode alterar os próprios papéis. Peça a outra pessoa com essa permissão.',
      );
    }

    await withTransaction(this.database.client, async (transaction) => {
      await this.repository.replaceRoles(transaction, {
        organizationId: actor.organizationId,
        userId: target.id,
        roleIds: unique,
      });
      await this.audit.recordDomainInTransaction(transaction, {
        organizationId: actor.organizationId,
        userId: actor.userId,
        entityId: target.id,
        entityType: 'user',
        action: 'user.roles.replaced',
        newData: { roleCount: unique.length },
        ...metadata,
      });
    });

    const updated = await this.repository.findManaged(actor.organizationId, target.id);
    return mapManagedUser(updated ?? target);
  }

  async changeStatus(
    actor: ActorContext,
    userId: string,
    status: 'ACTIVE' | 'BLOCKED',
    metadata: RequestAuditMetadata,
  ) {
    const target = await this.#requireUser(actor, userId);

    if (target.id === actor.userId) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'CANNOT_CHANGE_OWN_STATUS',
        'Você não pode bloquear nem reativar o próprio acesso.',
      );
    }

    // Reativar leva de volta a ACTIVE mesmo quem ainda não aceitou o convite? Não: quem está
    // em INVITED precisa passar pelo aceite para ter senha. Só bloqueado volta.
    const from = status === 'BLOCKED' ? (['ACTIVE', 'INVITED'] as const) : (['BLOCKED'] as const);

    const changed = await withTransaction(this.database.client, async (transaction) => {
      const applied = await this.repository.changeStatus(transaction, {
        organizationId: actor.organizationId,
        userId: target.id,
        from,
        to: status,
      });
      if (!applied) {
        return false;
      }

      const revokedSessions =
        status === 'BLOCKED'
          ? await this.repository.revokeSessions(transaction, {
              organizationId: actor.organizationId,
              userId: target.id,
              revokedAt: new Date(),
              reason: 'USER_BLOCKED',
            })
          : 0;

      await this.audit.recordDomainInTransaction(transaction, {
        organizationId: actor.organizationId,
        userId: actor.userId,
        entityId: target.id,
        entityType: 'user',
        action: status === 'BLOCKED' ? 'user.blocked' : 'user.reactivated',
        newData: { revokedSessions },
        ...metadata,
      });
      return true;
    });

    if (!changed) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'USER_STATUS_UNCHANGED',
        status === 'BLOCKED'
          ? 'Esta pessoa já está bloqueada.'
          : 'Só é possível reativar quem está bloqueado.',
      );
    }

    const updated = await this.repository.findManaged(actor.organizationId, target.id);
    return mapManagedUser(updated ?? target);
  }

  /** Pessoa de outro escritório e pessoa inexistente devolvem o mesmo 404. */
  async #requireUser(actor: ActorContext, userId: string): Promise<ManagedUserRecord> {
    const found = await this.repository.findManaged(actor.organizationId, userId);
    if (found === null) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'USER_NOT_FOUND', 'Pessoa não encontrada.');
    }
    return found;
  }
}
