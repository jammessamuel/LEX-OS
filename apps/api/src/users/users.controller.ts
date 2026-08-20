import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
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
import { InvitationResponseDto } from './dto/invitation-response.dto.js';
import { InviteUserRequestDto } from './dto/invite-user-request.dto.js';
import { InvitationsService } from './invitations.service.js';
import { ListAssignableUsersQueryDto } from './dto/list-assignable-users-query.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('Usuários')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly invitations: InvitationsService,
  ) {}

  #actor(request: AuthenticatedRequest) {
    if (request.actor === undefined) {
      throw new Error('Authenticated actor was not attached by the access-token guard.');
    }
    return request.actor;
  }

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
    return this.users.listAssignable(this.#actor(request), query, getRequestContext() ?? {});
  }

  @Post('invitations')
  @RequirePermissions('users.manage')
  @ApiOperation({
    summary: 'Convida uma pessoa e devolve o token de uso único uma única vez.',
    description:
      'O token não é recuperável depois: o banco guarda apenas o hash, e ele não entra em ' +
      'log nem em auditoria. Enquanto não houver adapter de e-mail (ADR-013), quem convida ' +
      'entrega o token por um canal que escolhe. Ver ADR-014, item 2.',
  })
  @ApiCreatedResponse({ type: InvitationResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiConflictResponse({ type: ApiErrorEnvelopeDto })
  invite(@Req() request: AuthenticatedRequest, @Body() input: InviteUserRequestDto) {
    return this.invitations.invite(this.#actor(request), input, getRequestContext() ?? {});
  }

  @Get('invitations')
  @RequirePermissions('users.manage')
  @ApiOperation({ summary: 'Lista os convites ainda abertos do escritório.' })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  listPendingInvitations(@Req() request: AuthenticatedRequest) {
    return this.invitations.listPending(this.#actor(request), getRequestContext() ?? {});
  }

  @Delete('invitations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('users.manage')
  @ApiOperation({ summary: 'Revoga um convite ainda não aceito.' })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  revokeInvitation(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.invitations.revoke(this.#actor(request), id, getRequestContext() ?? {});
  }
}
