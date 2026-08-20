import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { RuntimeConfig } from '@lex-os/config';
import { withTransaction } from '@lex-os/database';
import { JwtService } from '@nestjs/jwt';
import argon2 from 'argon2';

import { AuditService } from '../audit/audit.service.js';
import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import { DatabaseService } from '../database/database.service.js';
import { ApiException } from '../http/api-exception.js';
import type { ActorContext } from './actor-context.js';
import {
  ACCESS_TOKEN_AUDIENCE,
  ACCESS_TOKEN_ISSUER,
  REFRESH_TOKEN_BYTES,
} from './auth.constants.js';
import { AuthRepository } from './auth.repository.js';
import type { AuthTokenResponseDto } from './dto/auth-token-response.dto.js';
import type { LoginRequestDto } from './dto/login-request.dto.js';
import { LoginAttemptService } from './login-attempt.service.js';

interface RequestAuditMetadata {
  requestId?: string;
  correlationId?: string;
}

export interface IssuedAuthentication {
  response: AuthTokenResponseDto;
  refreshToken: string;
  refreshExpiresAt: Date;
}

type LoginUser = NonNullable<Awaited<ReturnType<AuthRepository['findLoginUserBySlug']>>>;

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function newRefreshToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
}

async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    return false;
  }
}

function optionalAuditMetadata(metadata: RequestAuditMetadata) {
  return {
    ...(metadata.requestId === undefined ? {} : { requestId: metadata.requestId }),
    ...(metadata.correlationId === undefined ? {} : { correlationId: metadata.correlationId }),
  };
}

interface PermissionBearingUser {
  organizationId: string;
  userRoles: Array<{
    role: {
      organizationId: string | null;
      rolePermissions: Array<{ permission: { code: string } }>;
    };
  }>;
}

/** Mantém o espelho do cliente idêntico à regra efetiva aplicada pelo guard da API. */
function effectivePermissions(user: PermissionBearingUser): string[] {
  const permissions = new Set<string>();

  for (const userRole of user.userRoles) {
    if (
      userRole.role.organizationId !== null &&
      userRole.role.organizationId !== user.organizationId
    ) {
      continue;
    }
    for (const rolePermission of userRole.role.rolePermissions) {
      permissions.add(rolePermission.permission.code);
    }
  }

  return [...permissions].sort((left, right) => left.localeCompare(right));
}

@Injectable()
export class AuthService {
  readonly #dummyPasswordHash: Promise<string>;

  constructor(
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
    private readonly jwt: JwtService,
    private readonly database: DatabaseService,
    private readonly repository: AuthRepository,
    private readonly attempts: LoginAttemptService,
    private readonly audit: AuditService,
  ) {
    this.#dummyPasswordHash = argon2.hash('lex-os-invalid-credential-comparison', {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  async login(
    input: LoginRequestDto,
    clientIp: string,
    metadata: RequestAuditMetadata,
  ): Promise<IssuedAuthentication> {
    await this.attempts.assertAllowed(input.organizationSlug, input.email, clientIp);
    const user = await this.repository.findLoginUserBySlug(input.organizationSlug, input.email);
    const passwordHash = user?.passwordHash ?? (await this.#dummyPasswordHash);
    const passwordMatches = await verifyPassword(passwordHash, input.password);

    if (user === null || !passwordMatches) {
      await this.attempts.recordFailure(input.organizationSlug, input.email, clientIp);

      if (user !== null) {
        await this.audit.recordAuthentication({
          organizationId: user.organizationId,
          userId: user.id,
          action: 'auth.login.failed',
          outcome: 'DENIED',
          reason: 'INVALID_CREDENTIALS',
          authenticatedActor: false,
          ...optionalAuditMetadata(metadata),
        });
      }

      throw this.#invalidCredentials();
    }

    if (!this.#isActiveLoginUser(user)) {
      await this.attempts.recordFailure(input.organizationSlug, input.email, clientIp);
      await this.audit.recordAuthentication({
        organizationId: user.organizationId,
        userId: user.id,
        action: 'auth.login.blocked',
        outcome: 'DENIED',
        reason: 'BLOCKED_USER',
        authenticatedActor: false,
        ...optionalAuditMetadata(metadata),
      });
      throw this.#invalidCredentials();
    }

    await this.attempts.clear(input.organizationSlug, input.email, clientIp);
    const refreshToken = newRefreshToken();
    const occurredAt = new Date();
    const refreshExpiresAt = new Date(
      occurredAt.getTime() + this.config.authentication.refreshTokenTtlSeconds * 1_000,
    );
    const sessionId = randomUUID();

    await withTransaction(this.database.client, async (transaction) => {
      const updated = await this.repository.markSuccessfulLogin(
        transaction,
        user.organizationId,
        user.id,
        occurredAt,
      );

      if (!updated) {
        throw this.#invalidCredentials();
      }

      await this.repository.createRefreshSession(transaction, {
        id: sessionId,
        organizationId: user.organizationId,
        userId: user.id,
        tokenFamilyId: randomUUID(),
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: refreshExpiresAt,
      });
      await this.audit.recordAuthenticationInTransaction(transaction, {
        organizationId: user.organizationId,
        userId: user.id,
        sessionId,
        action: 'auth.login.succeeded',
        outcome: 'SUCCEEDED',
        authenticatedActor: true,
        ...optionalAuditMetadata(metadata),
      });
    });

    return {
      response: await this.#tokenResponse(user, sessionId),
      refreshToken,
      refreshExpiresAt,
    };
  }

  async refresh(
    currentRefreshToken: string | undefined,
    metadata: RequestAuditMetadata,
  ): Promise<IssuedAuthentication> {
    if (currentRefreshToken === undefined || currentRefreshToken.length > 512) {
      throw this.#invalidSession();
    }

    const nextRefreshToken = newRefreshToken();
    const nextSessionId = randomUUID();
    const occurredAt = new Date();
    const refreshExpiresAt = new Date(
      occurredAt.getTime() + this.config.authentication.refreshTokenTtlSeconds * 1_000,
    );
    const rotation = await withTransaction(this.database.client, async (transaction) => {
      const session = await this.repository.findRefreshSessionByHash(
        transaction,
        hashRefreshToken(currentRefreshToken),
      );

      if (session === null) {
        return { succeeded: false as const };
      }

      const baseAudit = {
        organizationId: session.organizationId,
        userId: session.userId,
        sessionId: session.id,
        authenticatedActor: false,
        ...optionalAuditMetadata(metadata),
      };
      const replayed = session.rotatedAt !== null || session.revokedAt !== null;
      const activeIdentity =
        session.user.status === 'ACTIVE' &&
        session.user.deletedAt === null &&
        session.organization.status === 'ACTIVE' &&
        session.organization.deletedAt === null;
      const expired = session.expiresAt <= occurredAt;

      if (replayed) {
        await this.repository.revokeTokenFamily(
          transaction,
          session.tokenFamilyId,
          occurredAt,
          'REPLAY_DETECTED',
        );
        await this.audit.recordAuthenticationInTransaction(transaction, {
          ...baseAudit,
          action: 'auth.refresh.replayed',
          outcome: 'DENIED',
          reason: 'REPLAY_DETECTED',
        });
        return { succeeded: false as const };
      }

      if (!activeIdentity || expired) {
        await this.repository.revokeTokenFamily(
          transaction,
          session.tokenFamilyId,
          occurredAt,
          activeIdentity ? 'EXPIRED' : 'USER_BLOCKED',
        );
        await this.audit.recordAuthenticationInTransaction(transaction, {
          ...baseAudit,
          action: 'auth.refresh.revoked',
          outcome: 'DENIED',
          reason: activeIdentity ? 'EXPIRED' : 'BLOCKED_USER',
        });
        return { succeeded: false as const };
      }

      const rotated = await this.repository.markRefreshSessionRotated(
        transaction,
        session.id,
        occurredAt,
      );

      if (!rotated) {
        await this.repository.revokeTokenFamily(
          transaction,
          session.tokenFamilyId,
          occurredAt,
          'REPLAY_DETECTED',
        );
        await this.audit.recordAuthenticationInTransaction(transaction, {
          ...baseAudit,
          action: 'auth.refresh.replayed',
          outcome: 'DENIED',
          reason: 'REPLAY_DETECTED',
        });
        return { succeeded: false as const };
      }

      await this.repository.createRefreshSession(transaction, {
        id: nextSessionId,
        organizationId: session.organizationId,
        userId: session.userId,
        tokenFamilyId: session.tokenFamilyId,
        tokenHash: hashRefreshToken(nextRefreshToken),
        expiresAt: refreshExpiresAt,
      });
      await this.audit.recordAuthenticationInTransaction(transaction, {
        organizationId: session.organizationId,
        userId: session.userId,
        sessionId: nextSessionId,
        action: 'auth.refresh.succeeded',
        outcome: 'SUCCEEDED',
        authenticatedActor: true,
        ...optionalAuditMetadata(metadata),
      });

      return {
        succeeded: true as const,
        user: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          organizationId: session.organizationId,
          organization: {
            id: session.organization.id,
            tradeName: session.organization.tradeName,
          },
          userRoles: session.user.userRoles,
        },
      };
    });

    if (!rotation.succeeded) {
      throw this.#invalidSession();
    }

    return {
      response: await this.#tokenResponse(rotation.user, nextSessionId),
      refreshToken: nextRefreshToken,
      refreshExpiresAt,
    };
  }

  async logout(actor: ActorContext, metadata: RequestAuditMetadata): Promise<void> {
    const occurredAt = new Date();

    await withTransaction(this.database.client, async (transaction) => {
      const session = await this.repository.findSessionForLogout(
        transaction,
        actor.sessionId,
        actor.organizationId,
        actor.userId,
      );

      if (session === null) {
        throw this.#invalidSession();
      }

      await this.repository.revokeTokenFamily(
        transaction,
        session.tokenFamilyId,
        occurredAt,
        'LOGOUT',
      );
      await this.audit.recordAuthenticationInTransaction(transaction, {
        organizationId: actor.organizationId,
        userId: actor.userId,
        sessionId: actor.sessionId,
        action: 'auth.logout.succeeded',
        outcome: 'SUCCEEDED',
        reason: 'LOGOUT',
        authenticatedActor: true,
        ...optionalAuditMetadata(metadata),
      });
    });
  }

  #isActiveLoginUser(user: LoginUser): boolean {
    return (
      user.status === 'ACTIVE' &&
      user.deletedAt === null &&
      user.organization.status === 'ACTIVE' &&
      user.organization.deletedAt === null
    );
  }

  async #tokenResponse(
    user: {
      id: string;
      name: string;
      email: string;
      organizationId: string;
      organization: { id: string; tradeName: string };
      userRoles: PermissionBearingUser['userRoles'];
    },
    sessionId: string,
  ): Promise<AuthTokenResponseDto> {
    const expiresIn = this.config.authentication.accessTokenTtlSeconds;
    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        org: user.organizationId,
        sid: sessionId,
        typ: 'access',
      },
      {
        secret: this.config.authentication.accessTokenSecret,
        algorithm: 'HS256',
        expiresIn,
        issuer: ACCESS_TOKEN_ISSUER,
        audience: ACCESS_TOKEN_AUDIENCE,
      },
    );

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      user: { id: user.id, name: user.name, email: user.email },
      organization: { id: user.organization.id, tradeName: user.organization.tradeName },
      permissions: effectivePermissions(user),
    };
  }

  #invalidCredentials(): ApiException {
    return new ApiException(
      HttpStatus.UNAUTHORIZED,
      'INVALID_CREDENTIALS',
      'Organização, e-mail ou senha inválidos.',
    );
  }

  #invalidSession(): ApiException {
    return new ApiException(
      HttpStatus.UNAUTHORIZED,
      'INVALID_SESSION',
      'Sessão inválida ou expirada.',
    );
  }
}
