import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
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
import { CasesService } from './cases.service.js';
import { LegalHoldRequestDto } from './dto/legal-hold-request.dto.js';
import { CaseIdParamsDto } from './dto/case-id-params.dto.js';
import { CaseListResponseDto, CaseResponseDto } from './dto/case-response.dto.js';
import { CreateCaseRequestDto } from './dto/create-case-request.dto.js';
import { ListCasesQueryDto } from './dto/list-cases-query.dto.js';
import { UpdateCaseRequestDto } from './dto/update-case-request.dto.js';
import { UpdateProcessingBudgetRequestDto } from './dto/update-processing-budget-request.dto.js';

@ApiTags('Casos')
@ApiBearerAuth('access-token')
@Controller('cases')
export class CasesController {
  constructor(private readonly cases: CasesService) {}

  @Get()
  @RequirePermissions('cases.read')
  @ApiOperation({ summary: 'Lista casos acessíveis da organização autenticada.' })
  @ApiOkResponse({ type: CaseListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  list(@Req() request: AuthenticatedRequest, @Query() query: ListCasesQueryDto) {
    return this.cases.list(this.#actor(request), query, getRequestContext() ?? {});
  }

  @Get(':id')
  @RequirePermissions('cases.read')
  @ApiOperation({ summary: 'Retorna um caso acessível da organização autenticada.' })
  @ApiOkResponse({ type: CaseResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  get(@Req() request: AuthenticatedRequest, @Param() params: CaseIdParamsDto) {
    return this.cases.get(this.#actor(request), params.id, getRequestContext() ?? {});
  }

  @Post()
  @RequirePermissions('cases.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cria um caso na organização autenticada.' })
  @ApiCreatedResponse({ type: CaseResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiConflictResponse({ type: ApiErrorEnvelopeDto })
  create(@Req() request: AuthenticatedRequest, @Body() input: CreateCaseRequestDto) {
    return this.cases.create(this.#actor(request), input, getRequestContext() ?? {});
  }

  @Patch(':id')
  @RequirePermissions('cases.update')
  @ApiOperation({ summary: 'Atualiza um caso acessível da organização autenticada.' })
  @ApiOkResponse({ type: CaseResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  @ApiConflictResponse({ type: ApiErrorEnvelopeDto })
  update(
    @Req() request: AuthenticatedRequest,
    @Param() params: CaseIdParamsDto,
    @Body() input: UpdateCaseRequestDto,
  ) {
    return this.cases.update(this.#actor(request), params.id, input, getRequestContext() ?? {});
  }

  @Patch(':id/processing-budget')
  @RequirePermissions('cases.update')
  @ApiOperation({ summary: 'Configura ou libera novamente o teto rígido de processamento.' })
  @ApiOkResponse({ type: CaseResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  @ApiConflictResponse({ type: ApiErrorEnvelopeDto })
  updateProcessingBudget(
    @Req() request: AuthenticatedRequest,
    @Param() params: CaseIdParamsDto,
    @Body() input: UpdateProcessingBudgetRequestDto,
  ) {
    return this.cases.updateProcessingBudget(
      this.#actor(request),
      params.id,
      input.limitAmount,
      getRequestContext() ?? {},
    );
  }

  @Put(':id/legal-hold')
  @RequirePermissions('cases.legal_hold')
  @ApiOperation({
    summary: 'Põe ou retira a retenção obrigatória de um caso acessível (ADR-012).',
    description:
      'Com a retenção posta, nenhum caminho de exclusão alcança o caso nem nada dentro dele. ' +
      'A operação é auditada com autor, horário e motivo.',
  })
  @ApiOkResponse({ type: CaseResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  setLegalHold(
    @Req() request: AuthenticatedRequest,
    @Param() params: CaseIdParamsDto,
    @Body() input: LegalHoldRequestDto,
  ) {
    return this.cases.setLegalHold(
      this.#actor(request),
      params.id,
      input,
      getRequestContext() ?? {},
    );
  }

  @Delete(':id')
  @RequirePermissions('cases.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Exclui logicamente um caso acessível da organização autenticada.' })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  remove(@Req() request: AuthenticatedRequest, @Param() params: CaseIdParamsDto) {
    return this.cases.remove(this.#actor(request), params.id, getRequestContext() ?? {});
  }

  #actor(request: AuthenticatedRequest) {
    if (request.actor === undefined) {
      throw new Error('Authenticated actor was not attached by the access-token guard.');
    }
    return request.actor;
  }
}
