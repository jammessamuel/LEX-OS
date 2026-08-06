import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
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
import { CaseIdParamsDto } from '../cases/dto/case-id-params.dto.js';
import { ApiErrorEnvelopeDto } from '../http/error-envelope.dto.js';
import { getRequestContext } from '../observability/request-context.js';
import { ChecklistsService } from './checklists.service.js';
import { ApplyChecklistRequestDto } from './dto/apply-checklist-request.dto.js';
import { ChecklistItemIdParamsDto } from './dto/checklist-params.dto.js';
import {
  CaseChecklistItemResponseDto,
  CaseChecklistResponseDto,
  ChecklistTemplateResponseDto,
} from './dto/checklist-response.dto.js';
import { UpdateChecklistItemRequestDto } from './dto/update-checklist-item-request.dto.js';

@ApiTags('Checklists')
@ApiBearerAuth('access-token')
@Controller()
export class ChecklistsController {
  constructor(private readonly checklists: ChecklistsService) {}

  @Get('cases/:id/checklist-templates')
  @RequirePermissions('cases.read')
  @ApiOperation({ summary: 'Lista templates ativos compatíveis com um caso autorizado.' })
  @ApiOkResponse({ type: [ChecklistTemplateResponseDto] })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  listTemplates(@Req() request: AuthenticatedRequest, @Param() params: CaseIdParamsDto) {
    return this.checklists.listTemplates(
      this.#actor(request),
      params.id,
      getRequestContext() ?? {},
    );
  }

  @Get('cases/:id/checklists')
  @RequirePermissions('cases.read')
  @ApiOperation({ summary: 'Lista checklists e snapshots de itens de um caso autorizado.' })
  @ApiOkResponse({ type: [CaseChecklistResponseDto] })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  list(@Req() request: AuthenticatedRequest, @Param() params: CaseIdParamsDto) {
    return this.checklists.list(this.#actor(request), params.id, getRequestContext() ?? {});
  }

  @Post('cases/:id/checklists')
  @RequirePermissions('cases.update')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Aplica uma versão ativa de checklist e preserva o snapshot dos itens.',
  })
  @ApiCreatedResponse({ type: CaseChecklistResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  apply(
    @Req() request: AuthenticatedRequest,
    @Param() params: CaseIdParamsDto,
    @Body() input: ApplyChecklistRequestDto,
  ) {
    return this.checklists.apply(this.#actor(request), params.id, input, getRequestContext() ?? {});
  }

  @Patch('checklist-items/:id')
  @RequirePermissions('cases.update')
  @ApiOperation({ summary: 'Registra a revisão humana de um item de checklist autorizado.' })
  @ApiOkResponse({ type: CaseChecklistItemResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  updateItem(
    @Req() request: AuthenticatedRequest,
    @Param() params: ChecklistItemIdParamsDto,
    @Body() input: UpdateChecklistItemRequestDto,
  ) {
    return this.checklists.updateItem(
      this.#actor(request),
      params.id,
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
