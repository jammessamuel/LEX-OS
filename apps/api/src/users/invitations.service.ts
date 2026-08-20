import { HttpStatus, Injectable } from '@nestjs/common';
import { withTransaction } from '@lex-os/database';

import { AuditService, type RequestAuditMetadata } from '../audit/audit.service.js';
import type { ActorContext } from '../auth/actor-context.js';
import {
  dummyPasswordHash,
  hashOpaqueToken,
  hashPassword,
  newOpaqueToken,
} from '../auth/credential.js';
import { DatabaseService } from '../database/database.service.js';
import { ApiException } from '../http/api-exception.js';
import type { InvitationResponseDto } from './dto/invitation-response.dto.js';
import type { InviteUserRequestDto } from './dto/invite-user-request.dto.js';
import { InvitationsRepository, type InvitedUserRecord } from './invitations.repository.js';
import { RoleGrantService } from './role-grant.service.js';

/**
 * Sete dias. Curto o bastante para um link vazado envelhecer sozinho, longo o bastante para
 * atravessar férias de uma semana sem virar chamado.
 */
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function mapUser(record: InvitedUserRecord) {
  return { id: record.id, name: record.name, email: record.email, status: record.status };
}

@Injectable()
export class InvitationsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly repository: InvitationsRepository,
    private readonly audit: AuditService,
    private readonly grants: RoleGrantService,
  ) {}

  async invite(
    actor: ActorContext,
    input: InviteUserRequestDto,
    metadata: RequestAuditMetadata,
  ): Promise<InvitationResponseDto> {
    const existing = await this.repository.findActiveUserByEmail(actor.organizationId, input.email);
    if (existing !== null && existing.deletedAt === null) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'USER_ALREADY_EXISTS',
        'Já existe uma pessoa com esse e-mail no escritório.',
        [{ field: 'email', code: 'ALREADY_EXISTS', message: 'E-mail já cadastrado.' }],
      );
    }

    // Convidar não pode ser caminho de escalada; a regra é a mesma da troca de papel.
    const roleIds = [...new Set(input.roleIds)];
    await this.grants.assertGrantable(actor.organizationId, actor.userId, roleIds);

    const token = newOpaqueToken();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    const placeholderPasswordHash = await dummyPasswordHash();

    const created = await withTransaction(this.database.client, async (transaction) => {
      const user = await this.repository.createInvitedUser(transaction, {
        organizationId: actor.organizationId,
        name: input.name,
        email: input.email,
        placeholderPasswordHash,
        roleIds,
      });
      const invitation = await this.repository.createInvitation(transaction, {
        organizationId: actor.organizationId,
        userId: user.id,
        tokenHash: hashOpaqueToken(token),
        expiresAt,
        invitedById: actor.userId,
      });
      // Auditoria sem nome, e-mail ou token: registra que houve convite e o tamanho da
      // concessão, que é o que permite reconstituir a decisão depois.
      await this.audit.recordDomainInTransaction(transaction, {
        organizationId: actor.organizationId,
        userId: actor.userId,
        entityId: user.id,
        entityType: 'user',
        action: 'user.invited',
        newData: { roleCount: roleIds.length },
        ...metadata,
      });
      return { invitation, user };
    });

    return {
      id: created.invitation.id,
      user: mapUser(created.user),
      expiresAt: expiresAt.toISOString(),
      token,
    };
  }

  /**
   * Aceite. Não há sessão aqui: o token é a única prova apresentada, e por isso qualquer
   * recusa devolve a mesma mensagem — token inexistente, expirado, já usado ou revogado são
   * indistinguíveis para quem chama.
   */
  async accept(token: string, password: string, metadata: RequestAuditMetadata): Promise<void> {
    const invitation = await this.repository.findPendingByTokenHash(
      hashOpaqueToken(token),
      new Date(),
    );
    if (invitation === null) {
      throw this.#invalidInvitation();
    }

    const passwordHash = await hashPassword(password);
    const acceptedAt = new Date();

    const accepted = await withTransaction(this.database.client, async (transaction) => {
      // O consumo vem primeiro: se duas requisições chegarem com o mesmo token, a que perder
      // a cláusula não chega a tocar na senha.
      const consumed = await this.repository.consumeInvitation(transaction, {
        id: invitation.id,
        organizationId: invitation.organizationId,
        acceptedAt,
      });
      if (!consumed) {
        return false;
      }

      const activated = await this.repository.activateInvitedUser(transaction, {
        organizationId: invitation.organizationId,
        userId: invitation.userId,
        passwordHash,
      });
      if (!activated) {
        return false;
      }

      await this.audit.recordDomainInTransaction(transaction, {
        organizationId: invitation.organizationId,
        userId: invitation.userId,
        entityId: invitation.userId,
        entityType: 'user',
        action: 'user.invitation.accepted',
        newData: { activated: true },
        ...metadata,
      });
      return true;
    });

    if (!accepted) {
      throw this.#invalidInvitation();
    }
  }

  async listPending(actor: ActorContext, metadata: RequestAuditMetadata) {
    const rows = await this.repository.listPending(actor.organizationId, new Date());

    await this.audit.recordDomain({
      organizationId: actor.organizationId,
      userId: actor.userId,
      entityId: null,
      entityType: 'user',
      action: 'user.listed',
      newData: { count: rows.length },
      ...metadata,
    });

    return {
      data: rows.map((row) => ({
        id: row.id,
        user: mapUser(row.user),
        expiresAt: row.expiresAt.toISOString(),
      })),
    };
  }

  async revoke(actor: ActorContext, id: string, metadata: RequestAuditMetadata): Promise<void> {
    const revoked = await this.repository.revoke({
      id,
      organizationId: actor.organizationId,
      revokedAt: new Date(),
    });

    // Convite de outro escritório e convite inexistente resultam no mesmo 404: a resposta
    // não pode revelar que o identificador existe em algum lugar.
    if (!revoked) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'INVITATION_NOT_FOUND',
        'Convite não encontrado.',
      );
    }

    await this.audit.recordDomain({
      organizationId: actor.organizationId,
      userId: actor.userId,
      entityId: id,
      entityType: 'user',
      action: 'user.invitation.revoked',
      newData: { revoked: true },
      ...metadata,
    });
  }

  #invalidInvitation(): ApiException {
    return new ApiException(
      HttpStatus.UNAUTHORIZED,
      'INVITATION_INVALID',
      'Convite inválido ou expirado. Peça um novo ao escritório.',
    );
  }
}
