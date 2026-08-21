import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { RuntimeConfig } from '@lex-os/config';
import { withTransaction } from '@lex-os/database';
import {
  decryptSecret,
  encryptSecret,
  newRecoveryCodes,
  newTotpSecret,
  totpStepAt,
  totpUri,
  verifyTotp,
} from '@lex-os/shared';

import { AuditService, type RequestAuditMetadata } from '../audit/audit.service.js';
import type { ActorContext } from '../auth/actor-context.js';
import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import { DatabaseService } from '../database/database.service.js';
import { ApiException } from '../http/api-exception.js';
import { hashOpaqueToken } from './credential.js';
import { LoginAttemptService } from './login-attempt.service.js';
import { SecondFactorRepository } from './second-factor.repository.js';

const ISSUER = 'LEX OS';

export interface SecondFactorStatus {
  active: boolean;
  requiredByOrganization: boolean;
  unusedRecoveryCodes: number;
}

@Injectable()
export class SecondFactorService {
  constructor(
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
    private readonly database: DatabaseService,
    private readonly repository: SecondFactorRepository,
    private readonly audit: AuditService,
    private readonly attempts: LoginAttemptService,
  ) {}

  async status(actor: ActorContext): Promise<SecondFactorStatus> {
    const found = await this.#require(actor);
    return {
      active: found.totpActivatedAt !== null,
      requiredByOrganization: found.organization.requireSecondFactor,
      unusedRecoveryCodes:
        found.totpActivatedAt === null
          ? 0
          : await this.repository.countUnusedRecoveryCodes(actor.organizationId, actor.userId),
    };
  }

  /**
   * Começa a inscrição: gera um segredo, guarda cifrado e devolve o endereço que o
   * aplicativo autenticador lê. Nada é ativado aqui.
   *
   * Chamar de novo antes de ativar substitui o segredo — quem recomeça a inscrição em outro
   * telefone precisa disso. Com o segundo fator já ativo, é recusado: trocar de aparelho
   * passa por desligar com um código, que prova posse do atual.
   */
  async begin(
    actor: ActorContext,
    metadata: RequestAuditMetadata,
  ): Promise<{ secret: string; uri: string }> {
    const found = await this.#require(actor);
    if (found.totpActivatedAt !== null) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'SECOND_FACTOR_ALREADY_ACTIVE',
        'O segundo fator já está ativo. Desligue-o antes de cadastrar outro aparelho.',
      );
    }

    const secret = newTotpSecret();
    const staged = await this.repository.stageSecret(
      actor.organizationId,
      actor.userId,
      encryptSecret(secret, this.config.secondFactor.encryptionKey),
    );
    if (!staged) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'SECOND_FACTOR_ALREADY_ACTIVE',
        'O segundo fator já está ativo. Desligue-o antes de cadastrar outro aparelho.',
      );
    }

    await this.audit.recordAuthentication({
      organizationId: actor.organizationId,
      userId: actor.userId,
      action: 'auth.second_factor.enrolled',
      outcome: 'SUCCEEDED',
      authenticatedActor: true,
      ...metadata,
    });

    // O segredo sai daqui uma única vez, para o aplicativo. Ele não entra em log nem em
    // auditoria, e não há rota que o leia de novo.
    return { secret, uri: totpUri({ secret, account: found.email, issuer: ISSUER }) };
  }

  /** Ativa, provando posse com um código. Devolve os códigos de recuperação uma única vez. */
  async activate(
    actor: ActorContext,
    code: string,
    clientIp: string,
    metadata: RequestAuditMetadata,
  ): Promise<{ recoveryCodes: string[] }> {
    const found = await this.#require(actor);
    if (found.totpActivatedAt !== null) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'SECOND_FACTOR_ALREADY_ACTIVE',
        'O segundo fator já está ativo.',
      );
    }
    if (found.totpSecret === null) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'SECOND_FACTOR_NOT_STARTED',
        'Comece o cadastro do segundo fator antes de confirmar o código.',
      );
    }

    await this.#assertCodeAllowed(actor, found.email, clientIp);
    const secret = decryptSecret(found.totpSecret, this.config.secondFactor.encryptionKey);
    if (!verifyTotp(secret, code)) {
      await this.#recordCodeFailure(actor, found.email, clientIp, 'auth.second_factor.rejected');
      throw this.#invalidCode();
    }

    const codes = newRecoveryCodes();
    const activated = await withTransaction(this.database.client, async (transaction) => {
      const applied = await this.repository.activate(transaction, {
        organizationId: actor.organizationId,
        userId: actor.userId,
        activatedAt: new Date(),
        step: BigInt(totpStepAt()),
      });
      if (!applied) {
        return false;
      }
      await this.repository.replaceRecoveryCodes(transaction, {
        organizationId: actor.organizationId,
        userId: actor.userId,
        hashes: codes.map((value) => hashOpaqueToken(value)),
      });
      await this.audit.recordAuthenticationInTransaction(transaction, {
        organizationId: actor.organizationId,
        userId: actor.userId,
        action: 'auth.second_factor.activated',
        outcome: 'SUCCEEDED',
        authenticatedActor: true,
        ...metadata,
      });
      return true;
    });

    if (!activated) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'SECOND_FACTOR_ALREADY_ACTIVE',
        'O segundo fator já está ativo.',
      );
    }

    await this.attempts.clear(actor.organizationId, found.email, clientIp, 'totp');
    return { recoveryCodes: codes };
  }

  /**
   * Desliga, exigindo um código do aparelho atual.
   *
   * Sem essa prova, quem tomasse uma sessão aberta desligaria o segundo fator e teria a conta
   * inteira — o fator adicional protegeria só a porta da frente.
   */
  async disable(
    actor: ActorContext,
    code: string,
    clientIp: string,
    metadata: RequestAuditMetadata,
  ): Promise<void> {
    const found = await this.#require(actor);
    if (found.totpActivatedAt === null || found.totpSecret === null) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'SECOND_FACTOR_NOT_ACTIVE',
        'O segundo fator não está ativo.',
      );
    }
    if (found.organization.requireSecondFactor) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'SECOND_FACTOR_REQUIRED_BY_ORGANIZATION',
        'O escritório exige o segundo fator. Fale com quem administra o acesso.',
      );
    }

    await this.#assertCodeAllowed(actor, found.email, clientIp);
    const secret = decryptSecret(found.totpSecret, this.config.secondFactor.encryptionKey);
    if (!verifyTotp(secret, code)) {
      await this.#recordCodeFailure(actor, found.email, clientIp, 'auth.second_factor.rejected');
      throw this.#invalidCode();
    }

    await withTransaction(this.database.client, async (transaction) => {
      await this.repository.disable(transaction, {
        organizationId: actor.organizationId,
        userId: actor.userId,
      });
      await this.audit.recordAuthenticationInTransaction(transaction, {
        organizationId: actor.organizationId,
        userId: actor.userId,
        action: 'auth.second_factor.disabled',
        outcome: 'SUCCEEDED',
        authenticatedActor: true,
        ...metadata,
      });
    });
  }

  /**
   * Desafio da entrada.
   *
   * Só é chamado depois de a senha ser aceita: a existência do segundo fator não pode ser
   * revelada a quem errou a senha, senão a resposta vira um oráculo de quem já o ativou.
   *
   * Aceita o código do aplicativo ou um de recuperação, porque é exatamente na entrada que
   * alguém descobre que perdeu o telefone.
   */
  async assertLoginChallenge(
    user: {
      id: string;
      organizationId: string;
      email: string;
      totpSecret: string | null;
      totpActivatedAt: Date | null;
    },
    code: string | undefined,
    clientIp: string,
  ): Promise<void> {
    if (user.totpActivatedAt === null || user.totpSecret === null) {
      return;
    }

    if (code === undefined || code === '') {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        'SECOND_FACTOR_REQUIRED',
        'Informe o código do segundo fator para concluir a entrada.',
      );
    }

    await this.attempts.assertAllowed(user.organizationId, user.email, clientIp, 'totp');

    const accepted = /^\d{6}$/u.test(code)
      ? await this.#acceptAppCode(user, code)
      : await this.#acceptRecoveryCode(user, code);

    if (!accepted) {
      await this.attempts.recordFailure(user.organizationId, user.email, clientIp, 'totp');
      await this.audit.recordAuthentication({
        organizationId: user.organizationId,
        userId: user.id,
        action: 'auth.second_factor.rejected',
        outcome: 'DENIED',
        reason: 'INVALID_CREDENTIALS',
        authenticatedActor: false,
      });
      throw this.#invalidCode();
    }

    await this.attempts.clear(user.organizationId, user.email, clientIp, 'totp');
  }

  async #acceptAppCode(
    user: { id: string; organizationId: string; totpSecret: string | null },
    code: string,
  ): Promise<boolean> {
    if (user.totpSecret === null) {
      return false;
    }
    const secret = decryptSecret(user.totpSecret, this.config.secondFactor.encryptionKey);
    if (!verifyTotp(secret, code)) {
      return false;
    }
    // Consome o passo: o mesmo código não entra duas vezes dentro da janela de trinta
    // segundos, então interceptá-lo não dá uma segunda entrada.
    return this.repository.consumeStep(user.organizationId, user.id, BigInt(totpStepAt()));
  }

  async #acceptRecoveryCode(
    user: { id: string; organizationId: string },
    code: string,
  ): Promise<boolean> {
    const consumed = await this.repository.consumeRecoveryCode(
      user.organizationId,
      user.id,
      hashOpaqueToken(code.trim().toUpperCase()),
      new Date(),
    );
    if (consumed) {
      await this.audit.recordAuthentication({
        organizationId: user.organizationId,
        userId: user.id,
        action: 'auth.second_factor.recovery_used',
        outcome: 'SUCCEEDED',
        authenticatedActor: false,
      });
    }
    return consumed;
  }

  async #require(actor: ActorContext) {
    const found = await this.repository.findEnrolment(actor.organizationId, actor.userId);
    if (found === null) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'USER_NOT_FOUND', 'Pessoa não encontrada.');
    }
    return found;
  }

  /** Seis dígitos são adivinháveis por força bruta; o mesmo contador do login segura isso. */
  async #assertCodeAllowed(actor: ActorContext, email: string, clientIp: string): Promise<void> {
    await this.attempts.assertAllowed(actor.organizationId, email, clientIp, 'totp');
  }

  async #recordCodeFailure(
    actor: ActorContext,
    email: string,
    clientIp: string,
    action: 'auth.second_factor.rejected',
  ): Promise<void> {
    await this.attempts.recordFailure(actor.organizationId, email, clientIp, 'totp');
    await this.audit.recordAuthentication({
      organizationId: actor.organizationId,
      userId: actor.userId,
      action,
      outcome: 'DENIED',
      reason: 'INVALID_CREDENTIALS',
      authenticatedActor: true,
    });
  }

  #invalidCode(): ApiException {
    return new ApiException(
      HttpStatus.UNAUTHORIZED,
      'SECOND_FACTOR_CODE_INVALID',
      'Código inválido. Confira o aplicativo e tente de novo.',
    );
  }
}
