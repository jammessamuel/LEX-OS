import { Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import {
  ApiAcceptedResponse,
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
import { CaseExportsService } from './case-exports.service.js';
import { CaseExportIdParamsDto } from './dto/case-export-id-params.dto.js';
import { CaseExportResponseDto } from './dto/case-export-response.dto.js';

@ApiTags('Exportação')
@Controller()
export class CaseExportsController {
  constructor(private readonly exports: CaseExportsService) {}

  @Post('cases/:id/exports')
  @RequirePermissions('cases.read')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Pede o dossiê do caso em PDF. O documento é montado pelo worker.',
  })
  @ApiAcceptedResponse({ type: CaseExportResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  request(@Req() request: AuthenticatedRequest, @Param() params: CaseIdParamsDto) {
    return this.exports.request(this.#actor(request), params.id, getRequestContext() ?? {});
  }

  @Get('case-exports/:id')
  @RequirePermissions('cases.read')
  @ApiOperation({ summary: 'Situação do dossiê e, quando pronto, a URL assinada de download.' })
  @ApiOkResponse({ type: CaseExportResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  get(@Req() request: AuthenticatedRequest, @Param() params: CaseExportIdParamsDto) {
    return this.exports.get(this.#actor(request), params.id, getRequestContext() ?? {});
  }

  #actor(request: AuthenticatedRequest) {
    if (request.actor === undefined) {
      throw new Error('Authenticated actor was not attached by the access-token guard.');
    }
    return request.actor;
  }
}
