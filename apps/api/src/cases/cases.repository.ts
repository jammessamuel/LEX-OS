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
  legalHoldAt: true,
  legalHoldById: true,
  legalHoldReason: true,
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

  /**
   * Exclusão lógica do caso.
   *
   * `legalHoldAt: null` no `where` é a guarda de verdade, e é de propósito que ela viva aqui e
   * não no serviço: retenção obrigatória tem de valer para todo chamador, inclusive um futuro
   * caminho administrativo ou de reconciliação, e uma condição no filtro não se esquece de
   * chamar. Quem quiser a mensagem certa consulta o hold antes; quem esquecer, não exclui.
   */
  async softDelete(
    transaction: TransactionClient,
    organizationId: string,
    id: string,
    occurredAt: Date,
  ): Promise<boolean> {
    const result = await transaction.case.updateMany({
      where: { id, organizationId, deletedAt: null, legalHoldAt: null },
      data: { deletedAt: occurredAt },
    });
    return result.count === 1;
  }

  /**
   * O caso está sob retenção?
   *
   * Falha fechada: caso que não existe, ou cuja linha não pôde ser lida, conta como retido. A
   * decisão do ADR-012 é explícita — quando o estado do hold não puder ser determinado, a
   * exclusão é recusada.
   */
  async legalHoldOf(
    organizationId: string,
    id: string,
  ): Promise<{ held: true; reason: string; since: Date } | { held: false }> {
    const record = await this.database.client.case.findFirst({
      where: { id, organizationId },
      select: { legalHoldAt: true, legalHoldReason: true },
    });
    if (record === null) {
      return {
        held: true,
        reason: 'Não foi possível determinar a retenção do caso.',
        since: new Date(0),
      };
    }
    if (record.legalHoldAt === null || record.legalHoldReason === null) {
      return { held: false };
    }
    return { held: true, reason: record.legalHoldReason, since: record.legalHoldAt };
  }

  async setLegalHold(
    transaction: TransactionClient,
    organizationId: string,
    id: string,
    hold: { at: Date; byId: string; reason: string } | null,
  ): Promise<CaseRecord | null> {
    const result = await transaction.case.updateMany({
      where: { id, organizationId, deletedAt: null },
      data:
        hold === null
          ? { legalHoldAt: null, legalHoldById: null, legalHoldReason: null }
          : { legalHoldAt: hold.at, legalHoldById: hold.byId, legalHoldReason: hold.reason },
    });
    if (result.count !== 1) {
      return null;
    }
    // A releitura precisa vir da própria transação: o cliente base enxerga o banco de antes
    // do commit, e a resposta sairia dizendo que a retenção não foi posta — ela foi.
    return transaction.case.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: caseSelect,
    });
  }

  /**
   * Debita do orçamento do caso o custo de uma resposta do assistente (ADR-011).
   *
   * Até 2026-08-27 o assistente calculava o custo, gravava na auditoria e não descontava de
   * nada. O teto por caso existia e a única despesa que não passava por ele era justamente a
   * que o advogado dispara à mão, uma pergunta por vez, quantas vezes quiser.
   *
   * Debita depois de responder, e não antes: a resposta já foi gerada e o custo já existe.
   * Recusar a gravação aqui não desfaria a despesa — só a esconderia. O teto age na pergunta
   * seguinte, que é onde ele ainda consegue agir.
   */
  async chargeAssistantCost(
    transaction: TransactionClient,
    organizationId: string,
    caseId: string,
    amount: Prisma.Decimal,
  ): Promise<{ spent: Prisma.Decimal; limit: Prisma.Decimal; limitReached: boolean } | null> {
    const current = await transaction.case.findFirst({
      where: { organizationId, id: caseId, deletedAt: null },
      select: {
        processingCostLimitAmount: true,
        processingCostSpentAmount: true,
        processingCostReservedAmount: true,
      },
    });
    if (current === null) {
      return null;
    }
    const spent = current.processingCostSpentAmount.add(amount);
    const limit = current.processingCostLimitAmount;
    const limitReached =
      limit.greaterThan(0) &&
      spent.add(current.processingCostReservedAmount).greaterThanOrEqualTo(limit);

    await transaction.case.updateMany({
      where: { organizationId, id: caseId, deletedAt: null },
      data: {
        processingCostSpentAmount: spent,
        ...(limitReached
          ? {
              processingBudgetStatus: 'LIMIT_REACHED' as const,
              processingLimitReachedAt: new Date(),
            }
          : {}),
      },
    });
    return { spent, limit, limitReached };
  }
}
