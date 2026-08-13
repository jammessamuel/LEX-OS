import {
  Body,
  Controller,
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
  ApiConflictResponse,
  ApiBadRequestResponse,
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
import { ChecklistItemIdParamsDto } from '../checklists/dto/checklist-params.dto.js';
import { ApiErrorEnvelopeDto } from '../http/error-envelope.dto.js';
import { getRequestContext } from '../observability/request-context.js';
import { CreateChecklistTaskRequestDto } from './dto/create-checklist-task-request.dto.js';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto.js';
import { TaskListResponseDto, TaskResponseDto } from './dto/task-response.dto.js';
import { TaskIdParamsDto } from './dto/task-id-params.dto.js';
import { UpdateTaskRequestDto } from './dto/update-task-request.dto.js';
import { TasksService } from './tasks.service.js';

@ApiTags('Tarefas')
@ApiBearerAuth('access-token')
@Controller()
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get('cases/:id/tasks')
  @RequirePermissions('tasks.read')
  @ApiOperation({ summary: 'Lista tarefas rastreáveis de um caso autorizado.' })
  @ApiOkResponse({ type: TaskListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  list(
    @Req() request: AuthenticatedRequest,
    @Param() params: CaseIdParamsDto,
    @Query() query: ListTasksQueryDto,
  ) {
    return this.tasks.list(this.#actor(request), params.id, query, getRequestContext() ?? {});
  }

  @Post('checklist-items/:id/tasks')
  @RequirePermissions('tasks.manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cria uma tarefa rastreável a partir de um item pendente selecionado.' })
  @ApiCreatedResponse({ type: TaskResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  @ApiConflictResponse({ type: ApiErrorEnvelopeDto })
  createFromChecklist(
    @Req() request: AuthenticatedRequest,
    @Param() params: ChecklistItemIdParamsDto,
    @Body() input: CreateChecklistTaskRequestDto,
  ) {
    return this.tasks.createFromChecklistItem(
      this.#actor(request),
      params.id,
      input,
      getRequestContext() ?? {},
    );
  }

  @Patch('tasks/:id')
  @RequirePermissions('tasks.manage')
  @ApiOperation({ summary: 'Atualiza estado, prioridade, prazo ou responsável de uma tarefa.' })
  @ApiOkResponse({ type: TaskResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorEnvelopeDto })
  @ApiConflictResponse({ type: ApiErrorEnvelopeDto })
  update(
    @Req() request: AuthenticatedRequest,
    @Param() params: TaskIdParamsDto,
    @Body() input: UpdateTaskRequestDto,
  ) {
    return this.tasks.update(this.#actor(request), params.id, input, getRequestContext() ?? {});
  }

  #actor(request: AuthenticatedRequest) {
    if (request.actor === undefined) {
      throw new Error('Authenticated actor was not attached by the access-token guard.');
    }
    return request.actor;
  }
}
