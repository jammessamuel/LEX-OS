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
}
