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
import { DocumentIdParamsDto } from '../documents/dto/document-id-params.dto.js';
import { ApiErrorEnvelopeDto } from '../http/error-envelope.dto.js';
import { getRequestContext } from '../observability/request-context.js';
import { ExtractedEntityIdParamsDto } from './dto/extracted-entity-id-params.dto.js';
import {
  ExtractedEntityResponseDto,
  ExtractionListResponseDto,
} from './dto/extraction-response.dto.js';
import { ListExtractionsQueryDto } from './dto/list-extractions-query.dto.js';
import { ExtractionsService } from './extractions.service.js';

@ApiTags('Extrações')
@ApiBearerAuth('access-token')
@Controller()
export class ExtractionsController {
  constructor(private readonly extractions: ExtractionsService) {}

  @Get('documents/:id/extractions')
  @RequirePermissions('documents.read')
  @ApiOperation({ summary: 'Lista extrações persistidas de um documento autorizado.' })
  @ApiOkResponse({ type: ExtractionListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  list(
    @Req() request: AuthenticatedRequest,
    @Param() params: DocumentIdParamsDto,
    @Query() query: ListExtractionsQueryDto,
  ) {
    return this.extractions.list(this.#actor(request), params.id, query, getRequestContext() ?? {});
  }

  @Post('extracted-entities/:id/confirm')
  @RequirePermissions('documents.manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirma humanamente uma entidade extraída sem alterar a extração.' })
  @ApiOkResponse({ type: ExtractedEntityResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  @ApiConflictResponse({ type: ApiErrorEnvelopeDto })
  confirmEntity(@Req() request: AuthenticatedRequest, @Param() params: ExtractedEntityIdParamsDto) {
    return this.extractions.confirmEntity(
      this.#actor(request),
      params.id,
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
