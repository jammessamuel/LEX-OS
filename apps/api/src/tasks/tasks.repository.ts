import { Injectable } from '@nestjs/common';
import { Prisma, type Priority, type TaskStatus, type TransactionClient } from '@lex-os/database';

import { DatabaseService } from '../database/database.service.js';

const taskSelect = {
  id: true,
  organizationId: true,
  caseId: true,
  title: true,
  description: true,
  taskType: true,
  status: true,
  priority: true,
  assignedToId: true,
  createdById: true,
  dueAt: true,
  completedAt: true,
  sourceType: true,
  sourceId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TaskSelect;

export type TaskRecord = Prisma.TaskGetPayload<{ select: typeof taskSelect }>;

/**
 * A agenda mostra a tarefa junto do processo a que ela pertence.
 *
 * Um prazo sem o caso ao lado obriga a abrir cada linha para saber do que se trata, que é
 * exatamente o trabalho que a tela existe para poupar.
 */
const agendaSelect = {
  ...taskSelect,
  case: {
    select: {
      id: true,
      internalCode: true,
      cnjNumber: true,
      title: true,
      confidentialityLevel: true,
    },
  },
  assignedTo: { select: { id: true, name: true } },
} satisfies Prisma.TaskSelect;

export type AgendaTaskRecord = Prisma.TaskGetPayload<{ select: typeof agendaSelect }>;

/** Situações que ainda pedem ação. Concluída ou cancelada não é prazo, é histórico. */
const PENDING_STATUSES = ['OPEN', 'IN_PROGRESS'] as const satisfies readonly TaskStatus[];

export interface AgendaScope {
  organizationId: string;
  allowConfidential: boolean;
  assignedToId?: string;
}

/**
 * Recorte da agenda em SQL.
 *
 * Tarefa sem caso é do escritório e não tem sigilo a respeitar. Tarefa com caso só entra se o
 * caso estiver vivo e — sem a permissão de sigilo — se for padrão: a agenda não pode ser a
 * porta lateral que revela a existência de um caso confidencial pelo título do prazo.
 */
function agendaWhere(scope: AgendaScope): Prisma.TaskWhereInput {
  return {
    organizationId: scope.organizationId,
    deletedAt: null,
    status: { in: [...PENDING_STATUSES] },
    ...(scope.assignedToId === undefined ? {} : { assignedToId: scope.assignedToId }),
    AND: [
      {
        OR: [
          { caseId: null },
          {
            case: {
              deletedAt: null,
              ...(scope.allowConfidential ? {} : { confidentialityLevel: 'STANDARD' }),
            },
          },
        ],
      },
    ],
  };
}

export interface TaskCursor {
  createdAt: Date;
  id: string;
}

export interface UpdateTaskData {
  status?: TaskStatus;
  priority?: Priority;
  assignedToId?: string | null;
  dueAt?: Date | null;
  completedAt?: Date | null;
}

@Injectable()
export class TasksRepository {
  constructor(private readonly database: DatabaseService) {}

  list(
    organizationId: string,
    caseId: string,
    input: { cursor?: TaskCursor; status?: TaskStatus; take: number },
  ): Promise<TaskRecord[]> {
    return this.database.client.task.findMany({
      where: {
        organizationId,
        caseId,
        deletedAt: null,
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.cursor === undefined
          ? {}
          : {
              OR: [
                { createdAt: { lt: input.cursor.createdAt } },
                { createdAt: input.cursor.createdAt, id: { lt: input.cursor.id } },
              ],
            }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.take,
      select: taskSelect,
    });
  }

  /** Prazos dentro da janela pedida, do mais próximo ao mais distante. */
  agenda(
    scope: AgendaScope,
    window: { from: Date; to: Date },
    take: number,
  ): Promise<AgendaTaskRecord[]> {
    return this.database.client.task.findMany({
      where: { ...agendaWhere(scope), dueAt: { gte: window.from, lte: window.to } },
      orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
      take,
      select: agendaSelect,
    });
  }

  /** Vencidos antes da janela: o que ficou para trás não pode sumir da tela. */
  overdue(scope: AgendaScope, before: Date, take: number): Promise<AgendaTaskRecord[]> {
    return this.database.client.task.findMany({
      where: { ...agendaWhere(scope), dueAt: { lt: before } },
      orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
      take,
      select: agendaSelect,
    });
  }

  countAgenda(scope: AgendaScope, range: Prisma.DateTimeFilter): Promise<number> {
    return this.database.client.task.count({
      where: { ...agendaWhere(scope), dueAt: range },
    });
  }

  findById(organizationId: string, id: string): Promise<TaskRecord | null> {
    return this.database.client.task.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: taskSelect,
    });
  }

  async assignedUserExists(
    transaction: TransactionClient,
    organizationId: string,
    userId: string,
  ): Promise<boolean> {
    return (
      (await transaction.user.findFirst({
        where: { id: userId, organizationId, status: 'ACTIVE', deletedAt: null },
        select: { id: true },
      })) !== null
    );
  }

  createFromChecklist(
    transaction: TransactionClient,
    input: {
      organizationId: string;
      caseId: string;
      sourceId: string;
      title: string;
      description: string | null;
      priority: Priority;
      assignedToId: string | null;
      createdById: string;
      dueAt: Date | null;
    },
  ): Promise<TaskRecord> {
    return transaction.task.create({
      data: {
        organizationId: input.organizationId,
        caseId: input.caseId,
        title: input.title,
        description: input.description,
        taskType: 'DOCUMENT_COLLECTION',
        status: 'OPEN',
        priority: input.priority,
        assignedToId: input.assignedToId,
        createdById: input.createdById,
        dueAt: input.dueAt,
        sourceType: 'AI_CHECKLIST',
        sourceId: input.sourceId,
      },
      select: taskSelect,
    });
  }

  async update(
    transaction: TransactionClient,
    organizationId: string,
    id: string,
    expectedUpdatedAt: Date,
    data: UpdateTaskData,
  ): Promise<TaskRecord | null> {
    const result = await transaction.task.updateMany({
      where: { id, organizationId, deletedAt: null, updatedAt: expectedUpdatedAt },
      data,
    });
    if (result.count !== 1) {
      return null;
    }
    return transaction.task.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: taskSelect,
    });
  }
}
