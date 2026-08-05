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
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { RequirePermissions } from '../access-control/require-permissions.decorator.js';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { ApiErrorEnvelopeDto } from '../http/error-envelope.dto.js';
import { getRequestContext } from '../observability/request-context.js';
import { CreatePersonRequestDto } from './dto/create-person-request.dto.js';
import { ListPersonsQueryDto } from './dto/list-persons-query.dto.js';
import { PersonIdParamsDto } from './dto/person-id-params.dto.js';
import { PersonListResponseDto, PersonResponseDto } from './dto/person-response.dto.js';
import { UpdatePersonRequestDto } from './dto/update-person-request.dto.js';
import { PersonsService } from './persons.service.js';

@ApiTags('Pessoas')
@ApiBearerAuth('access-token')
@Controller('persons')
export class PersonsController {
  constructor(private readonly persons: PersonsService) {}

  @Get()
  @RequirePermissions('persons.read')
  @ApiOperation({ summary: 'Lista pessoas ativas da organização autenticada.' })
  @ApiOkResponse({ type: PersonListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  list(@Req() request: AuthenticatedRequest, @Query() query: ListPersonsQueryDto) {
    return this.persons.list(this.#actor(request), query);
  }

  @Get(':id')
  @RequirePermissions('persons.read')
  @ApiOperation({ summary: 'Retorna uma pessoa ativa da organização autenticada.' })
  @ApiOkResponse({ type: PersonResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  get(@Req() request: AuthenticatedRequest, @Param() params: PersonIdParamsDto) {
    return this.persons.get(this.#actor(request), params.id);
  }

  @Post()
  @RequirePermissions('persons.manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cadastra uma pessoa na organização autenticada.' })
  @ApiCreatedResponse({ type: PersonResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  create(@Req() request: AuthenticatedRequest, @Body() input: CreatePersonRequestDto) {
    return this.persons.create(this.#actor(request), input, getRequestContext() ?? {});
  }

  @Patch(':id')
  @RequirePermissions('persons.manage')
  @ApiOperation({ summary: 'Atualiza uma pessoa ativa da organização autenticada.' })
  @ApiOkResponse({ type: PersonResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  update(
    @Req() request: AuthenticatedRequest,
    @Param() params: PersonIdParamsDto,
    @Body() input: UpdatePersonRequestDto,
  ) {
    return this.persons.update(this.#actor(request), params.id, input, getRequestContext() ?? {});
  }

  @Delete(':id')
  @RequirePermissions('persons.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Exclui logicamente uma pessoa ativa da organização autenticada.' })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  remove(@Req() request: AuthenticatedRequest, @Param() params: PersonIdParamsDto) {
    return this.persons.remove(this.#actor(request), params.id, getRequestContext() ?? {});
  }

  #actor(request: AuthenticatedRequest) {
    if (request.actor === undefined) {
      throw new Error('Authenticated actor was not attached by the access-token guard.');
    }
    return request.actor;
  }
}
