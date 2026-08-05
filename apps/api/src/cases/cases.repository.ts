import { Injectable } from '@nestjs/common';
import { Prisma, type TransactionClient } from '@lex-os/database';

import { DatabaseService } from '../database/database.service.js';
import type { CaseStatusCode, ConfidentialityLevelCode, PriorityCode } from './case.constants.js';

const caseSelect = {
  id: true,
  organizationId: true,
  internalCode: true,
  title: true,
  description: true,
  legalArea: true,
  caseType: true,
  status: true,
  priority: true,
  confidentialityLevel: true,
  responsibleUserId: true,
  openedAt: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CaseSelect;

export type CaseRecord = Prisma.CaseGetPayload<{ select: typeof caseSelect }>;

export interface CaseCursor {
  updatedAt: Date;
  id: string;
}

export interface CreateCaseData {
  organizationId: string;
  internalCode: string;
  title: string;
  description: string | null;
  legalArea: string;
  caseType: string;
  status: CaseStatusCode;
  priority: PriorityCode;
  confidentialityLevel: ConfidentialityLevelCode;
  responsibleUserId: string | null;
  openedAt: Date;
  closedAt: Date | null;
}

export interface UpdateCaseData {
  internalCode?: string;
  title?: string;
  description?: string | null;
  legalArea?: string;
  caseType?: string;
  status?: CaseStatusCode;
  priority?: PriorityCode;
  confidentialityLevel?: ConfidentialityLevelCode;
  responsibleUserId?: string | null;
  openedAt?: Date;
  closedAt?: Date | null;
}

@Injectable()
export class CasesRepository {
  constructor(private readonly database: DatabaseService) {}

  list(
    organizationId: string,
    input: {
      status?: CaseStatusCode;
      priority?: PriorityCode;
      confidentialityLevel?: ConfidentialityLevelCode;
      responsibleUserId?: string;
      allowConfidential: boolean;
      cursor?: CaseCursor;
      take: number;
    },
  ): Promise<CaseRecord[]> {
    const cursorFilter =
      input.cursor === undefined
        ? {}
        : {
            OR: [
              { updatedAt: { lt: input.cursor.updatedAt } },
              { updatedAt: input.cursor.updatedAt, id: { lt: input.cursor.id } },
            ],
          };
    const confidentialityLevel = input.allowConfidential ? input.confidentialityLevel : 'STANDARD';

    return this.database.client.case.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.priority === undefined ? {} : { priority: input.priority }),
        ...(confidentialityLevel === undefined ? {} : { confidentialityLevel }),
        ...(input.responsibleUserId === undefined
          ? {}
          : { responsibleUserId: input.responsibleUserId }),
        ...cursorFilter,
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: input.take,
      select: caseSelect,
    });
  }

  findById(organizationId: string, id: string): Promise<CaseRecord | null> {
    return this.database.client.case.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: caseSelect,
    });
  }

  async responsibleExists(
    transaction: TransactionClient,
    organizationId: string,
    userId: string,
  ): Promise<boolean> {
    const user = await transaction.user.findFirst({
      where: { id: userId, organizationId, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });
    return user !== null;
  }

  create(transaction: TransactionClient, data: CreateCaseData): Promise<CaseRecord> {
    return transaction.case.create({ data, select: caseSelect });
  }

  async update(
    transaction: TransactionClient,
    organizationId: string,
    id: string,
    data: UpdateCaseData,
  ): Promise<CaseRecord | null> {
    const result = await transaction.case.updateMany({
      where: { id, organizationId, deletedAt: null },
      data,
    });
    if (result.count !== 1) {
      return null;
    }
    return transaction.case.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: caseSelect,
    });
  }

  async softDelete(
    transaction: TransactionClient,
    organizationId: string,
    id: string,
    occurredAt: Date,
  ): Promise<boolean> {
    const result = await transaction.case.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: occurredAt },
    });
    return result.count === 1;
  }
}
