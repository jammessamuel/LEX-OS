import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { RequirePermissions } from '../access-control/require-permissions.decorator.js';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { NestedCaseIdParamsDto } from '../cases/dto/case-id-params.dto.js';
import { ApiErrorEnvelopeDto } from '../http/error-envelope.dto.js';
import { getRequestContext } from '../observability/request-context.js';
import { CreateParticipantRequestDto } from './dto/create-participant-request.dto.js';
import { ListParticipantsQueryDto } from './dto/list-participants-query.dto.js';
import {
  ParticipantListResponseDto,
  ParticipantResponseDto,
} from './dto/participant-response.dto.js';
import { ParticipantsService } from './participants.service.js';

@ApiTags('Participantes')
@ApiBearerAuth('access-token')
@Controller('cases/:caseId/participants')
export class ParticipantsController {
  constructor(private readonly participants: ParticipantsService) {}

  @Get()
  @RequirePermissions('cases.read')
  @ApiOperation({ summary: 'Lista participantes de um caso acessível.' })
  @ApiOkResponse({ type: ParticipantListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  list(
    @Req() request: AuthenticatedRequest,
    @Param() params: NestedCaseIdParamsDto,
    @Query() query: ListParticipantsQueryDto,
  ) {
    return this.participants.list(
      this.#actor(request),
      params.caseId,
      query,
      getRequestContext() ?? {},
    );
  }

  @Post()
  @RequirePermissions('cases.update')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Associa uma pessoa a um caso acessível.' })
  @ApiCreatedResponse({ type: ParticipantResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  @ApiConflictResponse({ type: ApiErrorEnvelopeDto })
  create(
    @Req() request: AuthenticatedRequest,
    @Param() params: NestedCaseIdParamsDto,
    @Body() input: CreateParticipantRequestDto,
  ) {
    return this.participants.create(
      this.#actor(request),
      params.caseId,
      input,
      getRequestContext() ?? {},
    );
  }

  #actor(request: AuthenticatedRequest) {
    if (request.actor === undefined) {
      throw new Error('Authenticated actor was not attached by the access-token guard.');
    }
    return request.actor;
  }
}
