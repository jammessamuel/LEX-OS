import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req } from '@nestjs/common';
import {
  ApiAcceptedResponse,
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
import { ApiErrorEnvelopeDto } from '../http/error-envelope.dto.js';
import { getRequestContext } from '../observability/request-context.js';
import { DocumentIdParamsDto } from '../documents/dto/document-id-params.dto.js';
import { ListProcessingJobsQueryDto } from './dto/list-processing-jobs-query.dto.js';
import { ProcessingJobIdParamsDto } from './dto/processing-job-id-params.dto.js';
import {
  ProcessingJobListResponseDto,
  ProcessingJobResponseDto,
} from './dto/processing-job-response.dto.js';
import { ProcessingService } from './processing.service.js';

@ApiTags('Processamentos')
@ApiBearerAuth('access-token')
@Controller()
export class ProcessingController {
  constructor(private readonly processing: ProcessingService) {}

  @Get('processing-jobs')
  @RequirePermissions('documents.read')
  @ApiOperation({ summary: 'Lista processamentos persistidos e autorizados.' })
  @ApiOkResponse({ type: ProcessingJobListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  list(@Req() request: AuthenticatedRequest, @Query() query: ListProcessingJobsQueryDto) {
    return this.processing.list(this.#actor(request), query, getRequestContext() ?? {});
  }

  @Get('processing-jobs/:id')
  @RequirePermissions('documents.read')
  @ApiOperation({ summary: 'Retorna o estado persistido de um processamento autorizado.' })
  @ApiOkResponse({ type: ProcessingJobResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  get(@Req() request: AuthenticatedRequest, @Param() params: ProcessingJobIdParamsDto) {
    return this.processing.get(this.#actor(request), params.id, getRequestContext() ?? {});
  }

  @Post('documents/:id/reprocess')
  @RequirePermissions('documents.manage')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Cria uma nova execução OCR/texto sem sobrescrever extrações anteriores.',
  })
  @ApiAcceptedResponse({ type: ProcessingJobResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  @ApiConflictResponse({ type: ApiErrorEnvelopeDto })
  reprocess(@Req() request: AuthenticatedRequest, @Param() params: DocumentIdParamsDto) {
    return this.processing.reprocess(this.#actor(request), params.id, getRequestContext() ?? {});
  }

  #actor(request: AuthenticatedRequest) {
    if (request.actor === undefined) {
      throw new Error('Authenticated actor was not attached by the access-token guard.');
    }
    return request.actor;
  }
}
