import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
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
import { CaseDocumentParamsDto } from './dto/case-document-params.dto.js';
import { DocumentIdParamsDto } from './dto/document-id-params.dto.js';
import { DocumentListResponseDto, DocumentResponseDto } from './dto/document-response.dto.js';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto.js';
import { UpdateDocumentRequestDto } from './dto/update-document-request.dto.js';
import { DocumentsService } from './documents.service.js';

@ApiTags('Documentos')
@ApiBearerAuth('access-token')
@Controller()
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get('cases/:caseId/documents')
  @RequirePermissions('documents.read')
  @ApiOperation({ summary: 'Lista documentos ativos de um caso autorizado.' })
  @ApiOkResponse({ type: DocumentListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  list(
    @Req() request: AuthenticatedRequest,
    @Param() params: CaseDocumentParamsDto,
    @Query() query: ListDocumentsQueryDto,
  ) {
    return this.documents.list(
      this.#actor(request),
      params.caseId,
      query,
      getRequestContext() ?? {},
    );
  }

  @Get('documents/:id')
  @RequirePermissions('documents.read')
  @ApiOperation({ summary: 'Retorna um documento ativo e autorizado.' })
  @ApiOkResponse({ type: DocumentResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  get(@Req() request: AuthenticatedRequest, @Param() params: DocumentIdParamsDto) {
    return this.documents.get(this.#actor(request), params.id, getRequestContext() ?? {});
  }

  @Patch('documents/:id')
  @RequirePermissions('documents.update')
  @ApiOperation({ summary: 'Atualiza metadados humanos de um documento autorizado.' })
  @ApiOkResponse({ type: DocumentResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  update(
    @Req() request: AuthenticatedRequest,
    @Param() params: DocumentIdParamsDto,
    @Body() input: UpdateDocumentRequestDto,
  ) {
    return this.documents.update(this.#actor(request), params.id, input, getRequestContext() ?? {});
  }

  @Delete('documents/:id')
  @RequirePermissions('documents.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Exclui logicamente um documento autorizado.' })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  remove(@Req() request: AuthenticatedRequest, @Param() params: DocumentIdParamsDto) {
    return this.documents.remove(this.#actor(request), params.id, getRequestContext() ?? {});
  }

  #actor(request: AuthenticatedRequest) {
    if (request.actor === undefined) {
      throw new Error('Authenticated actor was not attached by the access-token guard.');
    }
    return request.actor;
  }
}
