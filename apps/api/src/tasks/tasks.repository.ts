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

export interface TaskCursor {
  createdAt: Date;
  id: string;
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
}
