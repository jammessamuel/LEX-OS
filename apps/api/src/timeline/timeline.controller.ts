import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { RequirePermissions } from '../access-control/require-permissions.decorator.js';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { CaseIdParamsDto } from '../cases/dto/case-id-params.dto.js';
import { ApiErrorEnvelopeDto } from '../http/error-envelope.dto.js';
import { getRequestContext } from '../observability/request-context.js';
import { ListTimelineEventsQueryDto } from './dto/list-timeline-events-query.dto.js';
import { TimelineEventIdParamsDto } from './dto/timeline-event-id-params.dto.js';
import {
  TimelineEventListResponseDto,
  TimelineEventResponseDto,
} from './dto/timeline-event-response.dto.js';
import { TimelineService } from './timeline.service.js';

@ApiTags('Cronologia')
@ApiBearerAuth('access-token')
@Controller()
export class TimelineController {
  constructor(private readonly timeline: TimelineService) {}

  @Get('cases/:id/timeline-events')
  @RequirePermissions('cases.read')
  @ApiOperation({ summary: 'Lista eventos cronológicos rastreáveis de um caso autorizado.' })
  @ApiOkResponse({ type: TimelineEventListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  list(
    @Req() request: AuthenticatedRequest,
    @Param() params: CaseIdParamsDto,
    @Query() query: ListTimelineEventsQueryDto,
  ) {
    return this.timeline.list(this.#actor(request), params.id, query, getRequestContext() ?? {});
  }

  @Post('timeline-events/:id/confirm')
  @RequirePermissions('cases.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirma humanamente um evento sem alterar sua extração de origem.' })
  @ApiOkResponse({ type: TimelineEventResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  @ApiConflictResponse({ type: ApiErrorEnvelopeDto })
  confirm(@Req() request: AuthenticatedRequest, @Param() params: TimelineEventIdParamsDto) {
    return this.timeline.confirm(this.#actor(request), params.id, getRequestContext() ?? {});
  }

  #actor(request: AuthenticatedRequest) {
    if (request.actor === undefined) {
      throw new Error('Authenticated actor was not attached by the access-token guard.');
    }
    return request.actor;
  }
}
