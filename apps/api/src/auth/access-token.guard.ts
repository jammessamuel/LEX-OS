import {
  HttpStatus,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { RuntimeConfig } from '@lex-os/config';
import { isUuidV4 } from '@lex-os/shared';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import { ApiException } from '../http/api-exception.js';
import { setAuthenticatedRequestContext } from '../observability/request-context.js';
import { ACCESS_TOKEN_AUDIENCE, ACCESS_TOKEN_ISSUER } from './auth.constants.js';
import { AuthRepository } from './auth.repository.js';
import type { AuthenticatedRequest } from './authenticated-request.js';
import { PUBLIC_ROUTE_METADATA } from './public.decorator.js';

interface AccessTokenPayload {
  sub: string;
  org: string;
  sid: string;
  typ: 'access';
}

function isAccessTokenPayload(value: unknown): value is AccessTokenPayload {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return (
    isUuidV4(payload.sub) &&
    isUuidV4(payload.org) &&
    isUuidV4(payload.sid) &&
    payload.typ === 'access'
  );
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly repository: AuthRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic === true) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (
      typeof authorization !== 'string' ||
      !authorization.startsWith('Bearer ') ||
      authorization.length > 4_103
    ) {
      throw this.#authenticationRequired();
    }

    let payload: unknown;

    try {
      payload = await this.jwt.verifyAsync(authorization.slice(7), {
        secret: this.config.authentication.accessTokenSecret,
        algorithms: ['HS256'],
        issuer: ACCESS_TOKEN_ISSUER,
        audience: ACCESS_TOKEN_AUDIENCE,
      });
    } catch {
      throw this.#authenticationRequired();
    }

    if (!isAccessTokenPayload(payload)) {
      throw this.#authenticationRequired();
    }

    const session = await this.repository.findActorSession(payload.sid);
    const now = new Date();

    if (
      session === null ||
      session.id !== payload.sid ||
      session.organizationId !== payload.org ||
      session.userId !== payload.sub ||
      session.revokedAt !== null ||
      session.expiresAt <= now ||
      session.user.status !== 'ACTIVE' ||
      session.user.deletedAt !== null ||
      session.organization.status !== 'ACTIVE' ||
      session.organization.deletedAt !== null
    ) {
      throw this.#authenticationRequired();
    }

    const permissions = new Set<string>();

    for (const userRole of session.user.userRoles) {
      if (
        userRole.role.organizationId !== null &&
        userRole.role.organizationId !== session.organizationId
      ) {
        continue;
      }

      for (const rolePermission of userRole.role.rolePermissions) {
        permissions.add(rolePermission.permission.code);
      }
    }

    request.actor = {
      userId: session.userId,
      organizationId: session.organizationId,
      sessionId: session.id,
      permissions,
    };
    setAuthenticatedRequestContext(request.actor);
    return true;
  }

  #authenticationRequired(): ApiException {
    return new ApiException(
      HttpStatus.UNAUTHORIZED,
      'AUTHENTICATION_REQUIRED',
      'Autenticação necessária.',
    );
  }
}
