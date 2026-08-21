import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { RuntimeConfig } from '@lex-os/config';
import { withTransaction } from '@lex-os/database';

import { AuditService, type RequestAuditMetadata } from '../audit/audit.service.js';
import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import { DatabaseService } from '../database/database.service.js';
import { ApiException } from '../http/api-exception.js';
import { EmailOutboxRepository } from '../users/email-outbox.repository.js';
import { hashOpaqueToken, hashPassword, newOpaqueToken } from './credential.js';
import { LoginAttemptService } from './login-attempt.service.js';
import { PasswordResetRepository } from './password-reset.repository.js';

/**
 * Recuperação de senha.
 *
 * Uma hora, e não os sete dias do convite: aqui a pessoa está na frente da tela agora, e um
 * link de redefinição vivo por uma semana é uma janela aberta sem motivo.
 */
const RESET_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class PasswordResetService {
  constructor(
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
    private readonly database: DatabaseService,
    private readonly repository: PasswordResetRepository,
    private readonly outbox: EmailOutboxRepository,
    private readonly audit: AuditService,
    private readonly attempts: LoginAttemptService,
  ) {}

  /**
   * Pedido de redefinição.
   *
   * Sempre responde igual, e esse é o ponto: se um endereço desconhecido respondesse
   * diferente de um cadastrado, a rota viraria um oráculo de quem trabalha no escritório —
   * e o slug já torna o escritório adivinhável. Pessoa bloqueada ou ainda convidada também
   * cai no silêncio, porque nenhuma das duas tem senha a redefinir.
   */
  async request(
    organizationSlug: string,
    email: string,
    clientIp: string,
    metadata: RequestAuditMetadata,
  ): Promise<void> {
    // O contador vem antes da busca e conta todo pedido, não só o que encontra alguém:
    // contar apenas os que acham transformaria o limite em oráculo de contas existentes.
    await this.attempts.assertAllowed(organizationSlug, email, clientIp, 'reset');
    await this.attempts.recordFailure(organizationSlug, email, clientIp, 'reset');

    const user = await this.repository.findResettableUser(organizationSlug, email);
    if (user === null) {
      return;
    }

    const token = newOpaqueToken();
    const expiresAt = new Date(Date.now() + RESET_TTL_MS);

    await withTransaction(this.database.client, async (transaction) => {
      // Pedido anterior ainda aberto é invalidado: dois links vivos para a mesma conta
      // dobram a superfície sem dobrar a utilidade.
      await this.repository.invalidateOpenRequests(transaction, {
        organizationId: user.organizationId,
        userId: user.id,
        at: new Date(),
      });
      await this.repository.createRequest(transaction, {
        organizationId: user.organizationId,
        userId: user.id,
        tokenHash: hashOpaqueToken(token),
        expiresAt,
      });
      await this.outbox.enqueue(transaction, {
        organizationId: user.organizationId,
        userId: user.id,
        templateId: 'password-reset',
        recipient: user.email,
        payload: {
          organizationName: user.organization.tradeName,
          recipientName: user.name,
          link: `${this.config.service.webOrigin}/nova-senha?token=${encodeURIComponent(token)}`,
          expiresAt: expiresAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        },
      });
      await this.audit.recordAuthenticationInTransaction(transaction, {
        organizationId: user.organizationId,
        userId: user.id,
        action: 'auth.password.reset.requested',
        outcome: 'SUCCEEDED',
        authenticatedActor: false,
        ...metadata,
      });
    });
  }

  /**
   * Conclusão. Recusa sempre com a mesma mensagem — inexistente, expirado, usado e de outro
   * escritório são indistinguíveis para quem só apresenta um token.
   */
  async reset(token: string, password: string, metadata: RequestAuditMetadata): Promise<void> {
    const found = await this.repository.findOpenByTokenHash(hashOpaqueToken(token), new Date());
    if (found === null) {
      throw this.#invalid();
    }

    const passwordHash = await hashPassword(password);
    const usedAt = new Date();

    const applied = await withTransaction(this.database.client, async (transaction) => {
      // Consome primeiro, com o estado esperado no `where`: dois pedidos simultâneos com o
      // mesmo token disputam a cláusula e só um troca a senha.
      const consumed = await this.repository.consume(transaction, {
        id: found.id,
        organizationId: found.organizationId,
        usedAt,
      });
      if (!consumed) {
        return false;
      }

      await this.repository.setPassword(transaction, {
        organizationId: found.organizationId,
        userId: found.userId,
        passwordHash,
      });

      // Quem redefine senha frequentemente o faz porque suspeita de acesso indevido. Manter
      // as sessões abertas depois disso entregaria a conta de volta a quem a tomou.
      const revokedSessions = await this.repository.revokeSessions(transaction, {
        organizationId: found.organizationId,
        userId: found.userId,
        revokedAt: usedAt,
      });

      await this.audit.recordAuthenticationInTransaction(transaction, {
        organizationId: found.organizationId,
        userId: found.userId,
        action: 'auth.password.reset.completed',
        outcome: 'SUCCEEDED',
        authenticatedActor: false,
        revokedSessions,
        ...metadata,
      });
      return true;
    });

    if (!applied) {
      throw this.#invalid();
    }
  }

  #invalid(): ApiException {
    return new ApiException(
      HttpStatus.UNAUTHORIZED,
      'PASSWORD_RESET_INVALID',
      'Pedido inválido ou expirado. Solicite uma nova redefinição.',
    );
  }
}
