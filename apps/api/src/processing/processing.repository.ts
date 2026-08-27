import { Injectable } from '@nestjs/common';
import { Prisma, type JobStatus, type JobType, type TransactionClient } from '@lex-os/database';

import { DatabaseService } from '../database/database.service.js';

const processingJobSelect = {
  id: true,
  organizationId: true,
  caseId: true,
  fileId: true,
  documentId: true,
  jobType: true,
  status: true,
  priority: true,
  attempts: true,
  version: true,
  provider: true,
  modelName: true,
  modelVersion: true,
  reservedCostAmount: true,
  costAmount: true,
  costCurrency: true,
  outputMetadata: true,
  errorCode: true,
  errorMessage: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
  updatedAt: true,
  case: { select: { confidentialityLevel: true, deletedAt: true } },
  document: { select: { deletedAt: true, file: { select: { deletedAt: true } } } },
} satisfies Prisma.ProcessingJobSelect;

export type ProcessingJobRecord = Prisma.ProcessingJobGetPayload<{
  select: typeof processingJobSelect;
}>;

/** Um recorte do custo somado no período. */
export interface ProcessingCostBucket {
  key: string | null;
  amount: Prisma.Decimal;
  executions: number;
}

export interface ProcessingCostTotals {
  total: Prisma.Decimal;
  executions: number;
  currency: string;
  buckets: readonly ProcessingCostBucket[];
}

export interface ProcessingJobCursor {
  createdAt: Date;
  id: string;
}

@Injectable()
export class ProcessingRepository {
  constructor(private readonly database: DatabaseService) {}

  list(
    organizationId: string,
    input: {
      cursor?: ProcessingJobCursor;
      caseId?: string;
      documentId?: string;
      jobType?: JobType;
      status?: JobStatus;
      provider?: string;
      modelName?: string;
      allowConfidential: boolean;
      take: number;
    },
  ): Promise<ProcessingJobRecord[]> {
    const cursorFilter =
      input.cursor === undefined
        ? {}
        : {
            OR: [
              { createdAt: { lt: input.cursor.createdAt } },
              { createdAt: input.cursor.createdAt, id: { lt: input.cursor.id } },
            ],
          };
    return this.database.client.processingJob.findMany({
      where: {
        organizationId,
        case: {
          deletedAt: null,
          ...(input.allowConfidential ? {} : { confidentialityLevel: 'STANDARD' }),
        },
        document: { deletedAt: null, file: { deletedAt: null } },
        ...(input.caseId === undefined ? {} : { caseId: input.caseId }),
        ...(input.documentId === undefined ? {} : { documentId: input.documentId }),
        ...(input.jobType === undefined ? {} : { jobType: input.jobType }),
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.provider === undefined ? {} : { provider: input.provider }),
        ...(input.modelName === undefined ? {} : { modelName: input.modelName }),
        ...cursorFilter,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.take,
      select: processingJobSelect,
    });
  }

  findById(organizationId: string, id: string): Promise<ProcessingJobRecord | null> {
    return this.database.client.processingJob.findFirst({
      where: {
        id,
        organizationId,
        case: { deletedAt: null },
        document: { deletedAt: null, file: { deletedAt: null } },
      },
      select: processingJobSelect,
    });
  }

  async createReprocessJob(
    transaction: TransactionClient,
    input: { organizationId: string; caseId: string; fileId: string; documentId: string },
  ): Promise<ProcessingJobRecord | null> {
    const activeCount = await transaction.processingJob.count({
      where: {
        organizationId: input.organizationId,
        documentId: input.documentId,
        status: { in: ['QUEUED', 'PROCESSING', 'RETRYING'] },
      },
    });
    if (activeCount > 0) {
      return null;
    }
    const job = await transaction.processingJob.create({
      data: {
        organizationId: input.organizationId,
        caseId: input.caseId,
        fileId: input.fileId,
        documentId: input.documentId,
        jobType: 'OCR',
        status: 'QUEUED',
        inputMetadata: { source: 'USER_REPROCESS' },
      },
      select: processingJobSelect,
    });
    await transaction.document.updateMany({
      where: { id: input.documentId, organizationId: input.organizationId, deletedAt: null },
      data: { processingStatus: 'QUEUED' },
    });
    return job;
  }

  /**
   * Custo somado no período, aberto pelo recorte pedido (ADR-011, verificação 3).
   *
   * O teto que já existia era por caso. Sem somar por organização, um escritório com trezentos
   * casos ativos não tinha teto nenhum de fato: cada caso respeitava o seu e a conta chegava
   * inteira no fim do mês, sem ninguém ter visto crescer.
   *
   * Conta só execução concluída com custo gravado. Trabalho reservado e não concluído não é
   * despesa: somá-lo mostraria um número que nunca vai ser cobrado.
   */
  async costSummary(
    organizationId: string,
    range: { from: Date; to: Date },
    groupBy: 'provider' | 'model' | 'jobType' | 'case',
  ): Promise<ProcessingCostTotals> {
    const where = {
      organizationId,
      costAmount: { not: null },
      finishedAt: { gte: range.from, lt: range.to },
    } satisfies Prisma.ProcessingJobWhereInput;

    const campo = {
      provider: 'provider',
      model: 'modelName',
      jobType: 'jobType',
      case: 'caseId',
    }[groupBy] as 'provider' | 'modelName' | 'jobType' | 'caseId';

    const [geral, grupos] = await Promise.all([
      this.database.client.processingJob.aggregate({
        where,
        _sum: { costAmount: true },
        _count: { _all: true },
      }),
      this.database.client.processingJob.groupBy({
        by: [campo],
        where,
        _sum: { costAmount: true },
        _count: { _all: true },
        orderBy: { _sum: { costAmount: 'desc' } },
      }),
    ]);

    return {
      total: geral._sum.costAmount ?? new Prisma.Decimal(0),
      executions: geral._count._all,
      // A moeda é a mesma da organização inteira por construção do modelo de custo; devolver a
      // do primeiro grupo evitaria uma consulta e mentiria no dia em que isso deixar de valer.
      currency: 'BRL',
      buckets: grupos.map((grupo) => ({
        key: (grupo as Record<string, unknown>)[campo] as string | null,
        amount: grupo._sum.costAmount ?? new Prisma.Decimal(0),
        executions: grupo._count._all,
      })),
    };
  }
}
