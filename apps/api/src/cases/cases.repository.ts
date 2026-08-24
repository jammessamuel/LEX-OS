import { Injectable } from '@nestjs/common';
import { Prisma, type TransactionClient } from '@lex-os/database';

import { DatabaseService } from '../database/database.service.js';
import type { CaseStatusCode, ConfidentialityLevelCode, PriorityCode } from './case.constants.js';

const caseSelect = {
  id: true,
  organizationId: true,
  internalCode: true,
  cnjNumber: true,
  court: true,
  courtDivision: true,
  title: true,
  description: true,
  legalArea: true,
  caseType: true,
  status: true,
  priority: true,
  confidentialityLevel: true,
  responsibleUserId: true,
  processingCostLimitAmount: true,
  processingCostSpentAmount: true,
  processingCostReservedAmount: true,
  processingCostCurrency: true,
  processingBudgetStatus: true,
  processingLimitReachedAt: true,
  responsibleUser: {
    select: {
      id: true,
      name: true,
    },
  },
  openedAt: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CaseSelect;

export type CaseRecord = Prisma.CaseGetPayload<{ select: typeof caseSelect }>;

function personCaseSelect(organizationId: string, personId: string) {
  return {
    ...caseSelect,
    participants: {
      where: { organizationId, personId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        role: true,
        side: true,
        isClient: true,
      },
    },
  } satisfies Prisma.CaseSelect;
}

export type PersonCaseRecord = Prisma.CaseGetPayload<{
  select: ReturnType<typeof personCaseSelect>;
}>;

export interface CaseCursor {
  updatedAt: Date;
  id: string;
}

export interface CreateCaseData {
  organizationId: string;
  internalCode: string;
  cnjNumber: string | null;
  court: string | null;
  courtDivision: string | null;
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
  cnjNumber?: string | null;
  court?: string | null;
  courtDivision?: string | null;
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

export type UpdateProcessingBudgetResult =
  | { outcome: 'UPDATED'; record: CaseRecord }
  | { outcome: 'BELOW_COMMITTED_COST' }
  | { outcome: 'NOT_FOUND' };

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
      search?: string;
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
    // Uma busca só, em três campos: é o número do processo, o código interno ou o título que a
    // pessoa tem na mão. Continua tudo dentro do escritório — o OR entra ao lado do filtro de
    // organização, nunca no lugar dele.
    // Vai dentro de AND porque o cursor também usa OR: os dois no mesmo objeto e um apaga o
    // outro — a busca sumiria a partir da segunda página, sem erro nenhum.
    const searchFilter =
      input.search === undefined
        ? {}
        : {
            AND: [
              {
                OR: [
                  { cnjNumber: { contains: input.search, mode: 'insensitive' as const } },
                  { internalCode: { contains: input.search, mode: 'insensitive' as const } },
                  { title: { contains: input.search, mode: 'insensitive' as const } },
                ],
              },
            ],
          };

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
        ...searchFilter,
        ...cursorFilter,
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: input.take,
      select: caseSelect,
    });
  }

  listForPerson(
    organizationId: string,
    personId: string,
    input: {
      allowConfidential: boolean;
      cursor?: CaseCursor;
      take: number;
    },
  ): Promise<PersonCaseRecord[]> {
    const cursorFilter =
      input.cursor === undefined
        ? {}
        : {
            OR: [
              { updatedAt: { lt: input.cursor.updatedAt } },
              { updatedAt: input.cursor.updatedAt, id: { lt: input.cursor.id } },
            ],
          };

    return this.database.client.case.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(input.allowConfidential ? {} : { confidentialityLevel: 'STANDARD' }),
        participants: { some: { organizationId, personId } },
        ...cursorFilter,
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: input.take,
      select: personCaseSelect(organizationId, personId),
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

  async updateProcessingBudget(
    transaction: TransactionClient,
    organizationId: string,
    id: string,
    limitAmount: Prisma.Decimal,
  ): Promise<UpdateProcessingBudgetResult> {
    const locked = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "cases"
      WHERE "organization_id" = ${organizationId}::uuid
        AND "id" = ${id}::uuid
        AND "deleted_at" IS NULL
      FOR UPDATE
    `);
    if (locked.length !== 1) {
      return { outcome: 'NOT_FOUND' };
    }
    const current = await transaction.case.findFirst({
      where: { organizationId, id, deletedAt: null },
      select: caseSelect,
    });
    if (current === null) {
      return { outcome: 'NOT_FOUND' };
    }
    const committed = current.processingCostSpentAmount.add(current.processingCostReservedAmount);
    if (limitAmount.lessThan(committed)) {
      return { outcome: 'BELOW_COMMITTED_COST' };
    }
    const limitReached =
      current.processingCostReservedAmount.isZero() &&
      limitAmount.greaterThan(0) &&
      current.processingCostSpentAmount.greaterThanOrEqualTo(limitAmount);
    const record = await transaction.case.update({
      where: { id },
      data: {
        processingCostLimitAmount: limitAmount,
        processingBudgetStatus: limitReached ? 'LIMIT_REACHED' : 'ACTIVE',
        processingLimitReachedAt: limitReached ? new Date() : null,
      },
      select: caseSelect,
    });
    return { outcome: 'UPDATED', record };
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
