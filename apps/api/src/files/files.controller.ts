import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';

import { RequirePermissions } from '../access-control/require-permissions.decorator.js';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { ApiErrorEnvelopeDto } from '../http/error-envelope.dto.js';
import { getRequestContext } from '../observability/request-context.js';
import { CaseFileParamsDto } from './dto/case-file-params.dto.js';
import { FileIdParamsDto } from './dto/file-id-params.dto.js';
import {
  DownloadUrlResponseDto,
  FileIntakeBatchResponseDto,
  FileListResponseDto,
} from './dto/file-response.dto.js';
import { ListFilesQueryDto } from './dto/list-files-query.dto.js';
import { FilesService } from './files.service.js';

@ApiTags('Arquivos')
@ApiBearerAuth('access-token')
@Controller()
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post('cases/:caseId/files/upload')
  @RequirePermissions('documents.upload')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Recebe arquivos de forma incremental para um caso autorizado.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: {
          type: 'array',
          maxItems: 10,
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiAcceptedResponse({ type: FileIntakeBatchResponseDto })
  @ApiPayloadTooLargeResponse({ type: ApiErrorEnvelopeDto })
  @ApiUnsupportedMediaTypeResponse({ type: ApiErrorEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorEnvelopeDto })
  upload(@Req() request: AuthenticatedRequest, @Param() params: CaseFileParamsDto) {
    return this.files.upload(
      this.#actor(request),
      params.caseId,
      request,
      getRequestContext() ?? {},
    );
  }

  @Get('cases/:caseId/files')
  @RequirePermissions('documents.read')
  @ApiOperation({ summary: 'Lista arquivos ativos de um caso autorizado.' })
  @ApiOkResponse({ type: FileListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  list(
    @Req() request: AuthenticatedRequest,
    @Param() params: CaseFileParamsDto,
    @Query() query: ListFilesQueryDto,
  ) {
    return this.files.list(this.#actor(request), params.caseId, query, getRequestContext() ?? {});
  }

  @Get('files/:id/download-url')
  @RequirePermissions('documents.read')
  @ApiOperation({ summary: 'Gera uma URL curta após autorizar tenant, caso e estado do arquivo.' })
  @ApiOkResponse({ type: DownloadUrlResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  @ApiConflictResponse({ type: ApiErrorEnvelopeDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorEnvelopeDto })
  downloadUrl(@Req() request: AuthenticatedRequest, @Param() params: FileIdParamsDto) {
    return this.files.createDownloadUrl(this.#actor(request), params.id, getRequestContext() ?? {});
  }

  #actor(request: AuthenticatedRequest) {
    if (request.actor === undefined) {
      throw new Error('Authenticated actor was not attached by the access-token guard.');
    }
    return request.actor;
  }
}
