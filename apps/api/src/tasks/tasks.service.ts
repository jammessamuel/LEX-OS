import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, withTransaction } from '@lex-os/database';

import { AuditService, type RequestAuditMetadata } from '../audit/audit.service.js';
import type { ActorContext } from '../auth/actor-context.js';
import { CasesService } from '../cases/cases.service.js';
import { ChecklistsService } from '../checklists/checklists.service.js';
import { DatabaseService } from '../database/database.service.js';
import { ApiException } from '../http/api-exception.js';
import {
  createTimestampIdCursorParser,
  decodeCursor,
  encodeCursor,
  type CursorPage,
} from '../http/pagination.js';
import type { CreateChecklistTaskRequestDto } from './dto/create-checklist-task-request.dto.js';
import type { ListTasksQueryDto } from './dto/list-tasks-query.dto.js';
import type { TaskResponseDto } from './dto/task-response.dto.js';
import type { UpdateTaskRequestDto } from './dto/update-task-request.dto.js';
import {
  TasksRepository,
  type TaskCursor,
  type TaskRecord,
  type UpdateTaskData,
} from './tasks.repository.js';

const parseCursor: (value: unknown) => TaskCursor | undefined =
  createTimestampIdCursorParser('createdAt');

function mapTask(record: TaskRecord): TaskResponseDto {
  return {
    id: record.id,
    caseId: record.caseId,
    title: record.title,
    description: record.description,
    taskType: record.taskType,
    status: record.status,
    priority: record.priority,
    assignedToId: record.assignedToId,
    createdById: record.createdById,
    dueAt: record.dueAt?.toISOString() ?? null,
    completedAt: record.completedAt?.toISOString() ?? null,
    sourceType: record.sourceType,
    sourceId: record.sourceId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function auditSnapshot(record: TaskRecord) {
  return {
    status: record.status,
    priority: record.priority,
    assignedToId: record.assignedToId,
    dueAt: record.dueAt?.toISOString() ?? null,
    completedAt: record.completedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class TasksService {
  constructor(
    private readonly database: DatabaseService,
    private readonly repository: TasksRepository,
    private readonly cases: CasesService,
    private readonly checklists: ChecklistsService,
    private readonly audit: AuditService,
  ) {}

  async list(
    actor: ActorContext,
    caseId: string,
    query: ListTasksQueryDto,
    metadata: RequestAuditMetadata,
  ): Promise<CursorPage<TaskResponseDto>> {
    await this.cases.assertAccessibleForFileResources(actor, caseId, metadata, 'TASKS');
    const cursor = decodeCursor(query.cursor, parseCursor);
    const rows = await this.repository.list(actor.organizationId, caseId, {
      ...(cursor === undefined ? {} : { cursor }),
      ...(query.status === undefined ? {} : { status: query.status }),
      take: query.limit + 1,
    });
    const hasNextPage = rows.length > query.limit;
    const pageRows = hasNextPage ? rows.slice(0, query.limit) : rows;
    const last = pageRows.at(-1);
    return {
      data: pageRows.map(mapTask),
      pageInfo: {
        hasNextPage,
        nextCursor:
          hasNextPage && last !== undefined
            ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
            : null,
      },
    };
  }

  async createFromChecklistItem(
    actor: ActorContext,
    itemId: string,
    input: CreateChecklistTaskRequestDto,
    metadata: RequestAuditMetadata,
  ): Promise<TaskResponseDto> {
    const source = await this.checklists.getTaskSource(actor, itemId, metadata);
    const assignedToId = input.assignedToId ?? null;
    try {
      const task = await withTransaction(this.database.client, async (transaction) => {
        if (
          assignedToId !== null &&
          !(await this.repository.assignedUserExists(
            transaction,
            actor.organizationId,
            assignedToId,
          ))
        ) {
          throw new ApiException(
            HttpStatus.BAD_REQUEST,
            'INVALID_TASK_ASSIGNEE',
            'O responsável pela tarefa não pertence à organização.',
          );
        }
        const created = await this.repository.createFromChecklist(transaction, {
          organizationId: actor.organizationId,
          caseId: source.caseId,
          sourceId: source.sourceId,
          title: `Providenciar: ${source.title}`,
          description: source.description,
          priority: input.priority ?? 'NORMAL',
          assignedToId,
          createdById: actor.userId,
          dueAt: input.dueAt === undefined ? null : new Date(input.dueAt),
        });
        await this.audit.recordDomainInTransaction(transaction, {
          organizationId: actor.organizationId,
          userId: actor.userId,
          entityId: created.id,
          entityType: 'task',
          action: 'task.created',
          newData: {
            caseId: source.caseId,
            sourceType: 'AI_CHECKLIST',
            sourceId: source.sourceId,
            status: 'OPEN',
            priority: created.priority,
            assignedToId: created.assignedToId,
          },
          ...metadata,
        });
        return created;
      });
      return mapTask(task);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'CHECKLIST_TASK_ALREADY_EXISTS',
          'Já existe uma tarefa ativa para este item.',
        );
      }
      throw error;
    }
  }

  async update(
    actor: ActorContext,
    id: string,
    input: UpdateTaskRequestDto,
    metadata: RequestAuditMetadata,
  ): Promise<TaskResponseDto> {
    const changedFields = Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([field]) => field)
      .sort();
    if (changedFields.length === 0) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'Dados inválidos.', [
        { field: 'body', code: 'notEmpty', message: 'Informe ao menos um campo para atualização.' },
      ]);
    }

    const current = await this.repository.findById(actor.organizationId, id);
    if (current === null) {
      throw this.#notFound();
    }
    if (current.caseId !== null) {
      await this.cases.assertAccessibleForFileResources(actor, current.caseId, metadata, 'TASKS');
    }
    if (input.status === 'COMPLETED' && current.status === 'COMPLETED') {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'TASK_ALREADY_COMPLETED',
        'A tarefa já foi concluída.',
      );
    }

    const assignedToId = input.assignedToId;
    const now = new Date();
    const data: UpdateTaskData = {
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(input.priority === undefined ? {} : { priority: input.priority }),
      ...(assignedToId === undefined ? {} : { assignedToId }),
      ...(input.dueAt === undefined
        ? {}
        : { dueAt: input.dueAt === null ? null : new Date(input.dueAt) }),
      ...(input.status === undefined
        ? {}
        : { completedAt: input.status === 'COMPLETED' ? now : null }),
    };

    const updated = await withTransaction(this.database.client, async (transaction) => {
      if (
        assignedToId !== undefined &&
        assignedToId !== null &&
        !(await this.repository.assignedUserExists(transaction, actor.organizationId, assignedToId))
      ) {
        throw new ApiException(
          HttpStatus.BAD_REQUEST,
          'INVALID_TASK_ASSIGNEE',
          'O responsável pela tarefa não pertence à organização.',
        );
      }

      const result = await this.repository.update(
        transaction,
        actor.organizationId,
        id,
        current.updatedAt,
        data,
      );
      if (result === null) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'TASK_UPDATE_CONFLICT',
          'A tarefa foi alterada por outra operação. Recarregue e tente novamente.',
        );
      }
      await this.audit.recordDomainInTransaction(transaction, {
        organizationId: actor.organizationId,
        userId: actor.userId,
        entityId: result.id,
        entityType: 'task',
        action: 'task.updated',
        oldData: auditSnapshot(current),
        newData: { ...auditSnapshot(result), changedFields },
        ...metadata,
      });
      return result;
    });

    return mapTask(updated);
  }

  #notFound(): ApiException {
    return new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Recurso não encontrado.');
  }
}
