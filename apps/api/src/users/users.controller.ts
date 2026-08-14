import { Controller, Get, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { RequirePermissions } from '../access-control/require-permissions.decorator.js';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { ApiErrorEnvelopeDto } from '../http/error-envelope.dto.js';
import { getRequestContext } from '../observability/request-context.js';
import { AssignableUserListResponseDto } from './dto/assignable-user-response.dto.js';
import { ListAssignableUsersQueryDto } from './dto/list-assignable-users-query.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('Usuários')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('assignable')
  @RequirePermissions('users.read')
  @ApiOperation({ summary: 'Lista somente identificador e nome dos usuários ativos atribuíveis.' })
  @ApiOkResponse({ type: AssignableUserListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  listAssignable(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListAssignableUsersQueryDto,
  ) {
    if (request.actor === undefined) {
      throw new Error('Authenticated actor was not attached by the access-token guard.');
    }
    return this.users.listAssignable(request.actor, query, getRequestContext() ?? {});
  }
}
