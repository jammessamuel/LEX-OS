import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { ApiException } from '../http/api-exception.js';
import { REQUIRED_PERMISSIONS_METADATA } from './require-permissions.decorator.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<readonly string[]>(
      REQUIRED_PERMISSIONS_METADATA,
      [context.getHandler(), context.getClass()],
    );

    if (required === undefined || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const actor = request.actor;

    if (actor === undefined || !required.every((permission) => actor.permissions.has(permission))) {
      throw new ApiException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Acesso negado.');
    }

    return true;
  }
}
