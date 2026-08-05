import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
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
import { ExtractionListResponseDto } from './dto/extraction-response.dto.js';
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

  #actor(request: AuthenticatedRequest) {
    if (request.actor === undefined) {
      throw new Error('Authenticated actor was not attached by the access-token guard.');
    }
    return request.actor;
  }
}
