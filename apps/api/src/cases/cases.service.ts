import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, withTransaction } from '@lex-os/database';

import {
  AuditService,
  type CaseAuditSnapshot,
  type RequestAuditMetadata,
} from '../audit/audit.service.js';
import type { ActorContext } from '../auth/actor-context.js';
import { DatabaseService } from '../database/database.service.js';
import { ApiException } from '../http/api-exception.js';
import {
  createTimestampIdCursorParser,
  decodeCursor,
  encodeCursor,
  type CursorPage,
} from '../http/pagination.js';
import type {
  ParticipantRoleCode,
  ParticipantSideCode,
} from '../participants/participant.constants.js';
import type { ConfidentialityLevelCode } from './case.constants.js';
import type { CaseResponseDto } from './dto/case-response.dto.js';
import type { CreateCaseRequestDto } from './dto/create-case-request.dto.js';
import type { ListCasesQueryDto } from './dto/list-cases-query.dto.js';
import type {
  PersonCaseListResponseDto,
  PersonCaseResponseDto,
} from './dto/person-case-response.dto.js';
import type { UpdateCaseRequestDto } from './dto/update-case-request.dto.js';
import {
  CasesRepository,
  type CaseCursor,
  type CaseRecord,
  type PersonCaseRecord,
  type UpdateCaseData,
} from './cases.repository.js';

const parseCaseCursor: (value: unknown) => CaseCursor | undefined =
  createTimestampIdCursorParser('updatedAt');

function mapCase(record: CaseRecord): CaseResponseDto {
  return {
    id: record.id,
    internalCode: record.internalCode,
    title: record.title,
    description: record.description,
    legalArea: record.legalArea,
    caseType: record.caseType,
    status: record.status,
    priority: record.priority,
    confidentialityLevel: record.confidentialityLevel,
    responsibleUserId: record.responsibleUserId,
    responsible: record.responsibleUser,
    processingCostLimitAmount: record.processingCostLimitAmount.toFixed(6),
    processingCostSpentAmount: record.processingCostSpentAmount.toFixed(6),
    processingCostReservedAmount: record.processingCostReservedAmount.toFixed(6),
    processingCostCurrency: record.processingCostCurrency,
    processingBudgetStatus: record.processingBudgetStatus,
    processingLimitReachedAt: record.processingLimitReachedAt?.toISOString() ?? null,
    openedAt: record.openedAt.toISOString(),
    closedAt: record.closedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function auditSnapshot(record: CaseRecord): CaseAuditSnapshot {
  return {
    status: record.status,
    priority: record.priority,
    confidentialityLevel: record.confidentialityLevel,
    responsibleUserId: record.responsibleUserId,
  };
}

function isConfidential(level: ConfidentialityLevelCode): boolean {
  return level !== 'STANDARD';
}

function mapPersonCase(record: PersonCaseRecord): PersonCaseResponseDto {
  return {
    case: mapCase(record),
    participations: record.participants.map((participation) => ({
      id: participation.id,
      role: participation.role as ParticipantRoleCode,
      side:
        participation.side === null
          ? null
          : (participation.side.toLowerCase() as ParticipantSideCode),
      isClient: participation.isClient,
    })),
  };
}

@Injectable()
export class CasesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly repository: CasesRepository,
    private readonly audit: AuditService,
  ) {}

  async list(
    actor: ActorContext,
    query: ListCasesQueryDto,
    metadata: RequestAuditMetadata,
  ): Promise<CursorPage<CaseResponseDto>> {
    const cursor = decodeCursor(query.cursor, parseCaseCursor);
    const allowConfidential = actor.permissions.has('confidential_cases.read');
    if (
      !allowConfidential &&
      query.confidentialityLevel !== undefined &&
      query.confidentialityLevel !== 'STANDARD'
    ) {
      return { data: [], pageInfo: { hasNextPage: false, nextCursor: null } };
    }
    const rows = await this.repository.list(actor.organizationId, {
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.priority === undefined ? {} : { priority: query.priority }),
      ...(query.confidentialityLevel === undefined
        ? {}
        : { confidentialityLevel: query.confidentialityLevel }),
      ...(query.responsibleUserId === undefined
        ? {}
        : { responsibleUserId: query.responsibleUserId }),
      ...(cursor === undefined ? {} : { cursor }),
      allowConfidential,
      take: query.limit + 1,
    });
    const hasNextPage = rows.length > query.limit;
    const pageRows = hasNextPage ? rows.slice(0, query.limit) : rows;
    const confidentialCount = pageRows.filter((record) =>
      isConfidential(record.confidentialityLevel),
    ).length;

    if (confidentialCount > 0) {
      await this.audit.recordDomain({
        organizationId: actor.organizationId,
        userId: actor.userId,
        entityId: null,
        entityType: 'case',
        action: 'case.confidential.read',
        newData: { access: 'LIST', count: confidentialCount },
        ...metadata,
      });
    }
    const last = pageRows.at(-1);
    return {
      data: pageRows.map(mapCase),
      pageInfo: {
        hasNextPage,
        nextCursor:
          hasNextPage && last !== undefined
            ? encodeCursor({ updatedAt: last.updatedAt.toISOString(), id: last.id })
            : null,
      },
    };
  }

  async get(
    actor: ActorContext,
    id: string,
    metadata: RequestAuditMetadata,
  ): Promise<CaseResponseDto> {
    const record = await this.#findAccessible(actor, id);
    if (isConfidential(record.confidentialityLevel)) {
      await this.#auditConfidentialRead(actor, record.id, 'DETAIL', metadata);
    }
    return mapCase(record);
  }

  async listForPerson(
    actor: ActorContext,
    personId: string,
    query: { cursor?: string; limit: number },
    metadata: RequestAuditMetadata,
  ): Promise<PersonCaseListResponseDto> {
    const cursor = decodeCursor(query.cursor, parseCaseCursor);
    const rows = await this.repository.listForPerson(actor.organizationId, personId, {
      allowConfidential: actor.permissions.has('confidential_cases.read'),
      ...(cursor === undefined ? {} : { cursor }),
      take: query.limit + 1,
    });
    const hasNextPage = rows.length > query.limit;
    const pageRows = hasNextPage ? rows.slice(0, query.limit) : rows;
    const confidentialCount = pageRows.filter((record) =>
      isConfidential(record.confidentialityLevel),
    ).length;

    if (confidentialCount > 0) {
      await this.audit.recordDomain({
        organizationId: actor.organizationId,
        userId: actor.userId,
        entityId: null,
        entityType: 'case',
        action: 'case.confidential.read',
        newData: { access: 'PERSON_CASES', count: confidentialCount },
        ...metadata,
      });
    }

    const last = pageRows.at(-1);
    return {
      data: pageRows.map(mapPersonCase),
      pageInfo: {
        hasNextPage,
        nextCursor:
          hasNextPage && last !== undefined
            ? encodeCursor({ updatedAt: last.updatedAt.toISOString(), id: last.id })
            : null,
      },
    };
  }

  async assertAccessibleForParticipants(
    actor: ActorContext,
    id: string,
    metadata: RequestAuditMetadata,
    auditRead: boolean,
  ): Promise<void> {
    const record = await this.#findAccessible(actor, id);
    if (auditRead && isConfidential(record.confidentialityLevel)) {
      await this.#auditConfidentialRead(actor, record.id, 'PARTICIPANTS', metadata);
    }
  }

  async assertAccessibleForFileResources(
    actor: ActorContext,
    id: string,
    metadata: RequestAuditMetadata,
    access?:
      'CHECKLISTS' | 'DOCUMENTS' | 'DOWNLOAD' | 'FILES' | 'PROCESSING' | 'TASKS' | 'TIMELINE',
  ): Promise<void> {
    const record = await this.#findAccessible(actor, id);
    if (access !== undefined && isConfidential(record.confidentialityLevel)) {
      await this.#auditConfidentialRead(actor, record.id, access, metadata);
    }
  }

  async create(
    actor: ActorContext,
    input: CreateCaseRequestDto,
    metadata: RequestAuditMetadata,
  ): Promise<CaseResponseDto> {
    const confidentialityLevel = input.confidentialityLevel ?? 'STANDARD';
    this.#assertCanUseConfidentiality(actor, confidentialityLevel);
    const openedAt = input.openedAt === undefined ? new Date() : new Date(input.openedAt);
    const closedAt =
      input.closedAt === undefined || input.closedAt === null ? null : new Date(input.closedAt);
    this.#assertDates(openedAt, closedAt);

    try {
      const record = await withTransaction(this.database.client, async (transaction) => {
        await this.#assertResponsible(transaction, actor.organizationId, input.responsibleUserId);
        const created = await this.repository.create(transaction, {
          organizationId: actor.organizationId,
          internalCode: input.internalCode,
          title: input.title,
          description: input.description ?? null,
          legalArea: input.legalArea,
          caseType: input.caseType,
          status: input.status ?? 'INTAKE',
          priority: input.priority ?? 'NORMAL',
          confidentialityLevel,
          responsibleUserId: input.responsibleUserId ?? null,
          openedAt,
          closedAt,
        });
        await this.audit.recordDomainInTransaction(transaction, {
          organizationId: actor.organizationId,
          userId: actor.userId,
          entityId: created.id,
          entityType: 'case',
          action: 'case.created',
          newData: auditSnapshot(created),
          ...metadata,
        });
        return created;
      });
      return mapCase(record);
    } catch (error: unknown) {
      this.#rethrowKnownWriteError(error);
    }
  }

  async update(
    actor: ActorContext,
    id: string,
    input: UpdateCaseRequestDto,
    metadata: RequestAuditMetadata,
  ): Promise<CaseResponseDto> {
    const changedFields = Object.keys(input).sort();
    if (changedFields.length === 0) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'Dados inválidos.', [
        { field: 'body', code: 'notEmpty', message: 'Informe ao menos um campo para atualização.' },
      ]);
    }
    const current = await this.#findAccessible(actor, id);
    const nextConfidentiality = input.confidentialityLevel ?? current.confidentialityLevel;
    this.#assertCanUseConfidentiality(actor, nextConfidentiality);
    const nextOpenedAt = input.openedAt === undefined ? current.openedAt : new Date(input.openedAt);
    const nextClosedAt =
      input.closedAt === undefined
        ? current.closedAt
        : input.closedAt === null
          ? null
          : new Date(input.closedAt);
    this.#assertDates(nextOpenedAt, nextClosedAt);
    const data: UpdateCaseData = {
      ...(input.internalCode === undefined ? {} : { internalCode: input.internalCode }),
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.description === undefined ? {} : { description: input.description }),
      ...(input.legalArea === undefined ? {} : { legalArea: input.legalArea }),
      ...(input.caseType === undefined ? {} : { caseType: input.caseType }),
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(input.priority === undefined ? {} : { priority: input.priority }),
      ...(input.confidentialityLevel === undefined
        ? {}
        : { confidentialityLevel: input.confidentialityLevel }),
      ...(input.responsibleUserId === undefined
        ? {}
        : { responsibleUserId: input.responsibleUserId }),
      ...(input.openedAt === undefined ? {} : { openedAt: nextOpenedAt }),
      ...(input.closedAt === undefined ? {} : { closedAt: nextClosedAt }),
    };

    try {
      const updated = await withTransaction(this.database.client, async (transaction) => {
        await this.#assertResponsible(transaction, actor.organizationId, input.responsibleUserId);
        const result = await this.repository.update(transaction, actor.organizationId, id, data);
        if (result === null) {
          throw this.#notFound();
        }
        await this.audit.recordDomainInTransaction(transaction, {
          organizationId: actor.organizationId,
          userId: actor.userId,
          entityId: result.id,
          entityType: 'case',
          action: 'case.updated',
          oldData: auditSnapshot(current),
          newData: { ...auditSnapshot(result), changedFields },
          ...metadata,
        });
        return result;
      });
      return mapCase(updated);
    } catch (error: unknown) {
      this.#rethrowKnownWriteError(error);
    }
  }

  async updateProcessingBudget(
    actor: ActorContext,
    id: string,
    limitAmount: string,
    metadata: RequestAuditMetadata,
  ): Promise<CaseResponseDto> {
    const current = await this.#findAccessible(actor, id);
    const result = await withTransaction(this.database.client, async (transaction) => {
      const updated = await this.repository.updateProcessingBudget(
        transaction,
        actor.organizationId,
        id,
        new Prisma.Decimal(limitAmount),
      );
      if (updated.outcome === 'NOT_FOUND') {
        throw this.#notFound();
      }
      if (updated.outcome === 'BELOW_COMMITTED_COST') {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'PROCESSING_BUDGET_BELOW_COMMITTED_COST',
          'O teto não pode ser menor que o custo já consumido ou reservado.',
        );
      }
      await this.audit.recordDomainInTransaction(transaction, {
        organizationId: actor.organizationId,
        userId: actor.userId,
        entityId: id,
        entityType: 'case',
        action: 'case.processing_budget.updated',
        oldData: {
          limitAmount: current.processingCostLimitAmount.toFixed(6),
          currency: current.processingCostCurrency,
          status: current.processingBudgetStatus,
        },
        newData: {
          limitAmount: updated.record.processingCostLimitAmount.toFixed(6),
          currency: updated.record.processingCostCurrency,
          status: updated.record.processingBudgetStatus,
        },
        ...metadata,
      });
      return updated.record;
    });
    return mapCase(result);
  }

  async remove(actor: ActorContext, id: string, metadata: RequestAuditMetadata): Promise<void> {
    const current = await this.#findAccessible(actor, id);
    await withTransaction(this.database.client, async (transaction) => {
      const removed = await this.repository.softDelete(
        transaction,
        actor.organizationId,
        id,
        new Date(),
      );
      if (!removed) {
        throw this.#notFound();
      }
      await this.audit.recordDomainInTransaction(transaction, {
        organizationId: actor.organizationId,
        userId: actor.userId,
        entityId: id,
        entityType: 'case',
        action: 'case.deleted',
        oldData: auditSnapshot(current),
        newData: { ...auditSnapshot(current), softDeleted: true },
        ...metadata,
      });
    });
  }

  async #findAccessible(actor: ActorContext, id: string): Promise<CaseRecord> {
    const record = await this.repository.findById(actor.organizationId, id);
    if (
      record === null ||
      (isConfidential(record.confidentialityLevel) &&
        !actor.permissions.has('confidential_cases.read'))
    ) {
      throw this.#notFound();
    }
    return record;
  }

  #assertCanUseConfidentiality(actor: ActorContext, level: ConfidentialityLevelCode): void {
    if (isConfidential(level) && !actor.permissions.has('confidential_cases.read')) {
      throw new ApiException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Acesso negado.');
    }
  }

  async #assertResponsible(
    transaction: Parameters<CasesRepository['responsibleExists']>[0],
    organizationId: string,
    responsibleUserId: string | null | undefined,
  ): Promise<void> {
    if (
      responsibleUserId !== undefined &&
      responsibleUserId !== null &&
      !(await this.repository.responsibleExists(transaction, organizationId, responsibleUserId))
    ) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'INVALID_CASE_RESPONSIBLE',
        'Responsável inválido.',
      );
    }
  }

  #assertDates(openedAt: Date, closedAt: Date | null): void {
    if (closedAt !== null && closedAt < openedAt) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'Dados inválidos.', [
        {
          field: 'closedAt',
          code: 'minimumDate',
          message: 'A data de encerramento não pode ser anterior à abertura.',
        },
      ]);
    }
  }

  async #auditConfidentialRead(
    actor: ActorContext,
    caseId: string,
    access:
      | 'CHECKLISTS'
      | 'DETAIL'
      | 'DOCUMENTS'
      | 'DOWNLOAD'
      | 'FILES'
      | 'PARTICIPANTS'
      | 'PROCESSING'
      | 'TASKS'
      | 'TIMELINE',
    metadata: RequestAuditMetadata,
  ): Promise<void> {
    await this.audit.recordDomain({
      organizationId: actor.organizationId,
      userId: actor.userId,
      entityId: caseId,
      entityType: 'case',
      action: 'case.confidential.read',
      newData: { access },
      ...metadata,
    });
  }

  #rethrowKnownWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'CASE_INTERNAL_CODE_CONFLICT',
        'Já existe um caso com esse código interno.',
      );
    }
    throw error;
  }

  #notFound(): ApiException {
    return new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Recurso não encontrado.');
  }
}
