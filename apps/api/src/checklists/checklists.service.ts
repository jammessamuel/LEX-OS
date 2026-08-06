import { HttpStatus, Injectable } from '@nestjs/common';
import { withTransaction } from '@lex-os/database';

import { AuditService, type RequestAuditMetadata } from '../audit/audit.service.js';
import type { ActorContext } from '../auth/actor-context.js';
import { CasesService } from '../cases/cases.service.js';
import { DatabaseService } from '../database/database.service.js';
import { ApiException } from '../http/api-exception.js';
import type { ApplyChecklistRequestDto } from './dto/apply-checklist-request.dto.js';
import type {
  CaseChecklistItemResponseDto,
  CaseChecklistResponseDto,
  ChecklistTemplateResponseDto,
} from './dto/checklist-response.dto.js';
import type { UpdateChecklistItemRequestDto } from './dto/update-checklist-item-request.dto.js';
import {
  ChecklistsRepository,
  type CaseChecklistRecord,
  type ChecklistItemRecord,
  type ChecklistTemplateRecord,
} from './checklists.repository.js';

const documentRequiredStatuses = new Set([
  'RECEIVED',
  'INVALID',
  'EXPIRED',
  'ILLEGIBLE',
  'AWAITING_VALIDATION',
  'VALIDATED',
]);
const humanReviewedStatuses = new Set([
  'INVALID',
  'EXPIRED',
  'ILLEGIBLE',
  'VALIDATED',
  'NOT_APPLICABLE',
]);
const taskableStatuses = new Set(['MISSING', 'INVALID', 'EXPIRED', 'ILLEGIBLE']);

function mapTemplate(record: ChecklistTemplateRecord): ChecklistTemplateResponseDto {
  return {
    id: record.id,
    name: record.name,
    legalArea: record.legalArea,
    caseType: record.caseType,
    version: record.version,
    items: record.items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      isRequired: item.isRequired,
      sortOrder: item.sortOrder,
      documentTypeId: item.documentTypeId,
      documentTypeCode: item.documentType?.code ?? null,
    })),
  };
}

function mapItem(record: ChecklistItemRecord): CaseChecklistItemResponseDto {
  return {
    id: record.id,
    caseChecklistId: record.caseChecklistId,
    templateItemId: record.templateItemId,
    title: record.titleSnapshot,
    description: record.descriptionSnapshot,
    isRequired: record.isRequiredSnapshot,
    status: record.status,
    documentId: record.documentId,
    validatedById: record.validatedById,
    validatedAt: record.validatedAt?.toISOString() ?? null,
    notes: record.notes,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapChecklist(record: CaseChecklistRecord): CaseChecklistResponseDto {
  return {
    id: record.id,
    caseId: record.caseId,
    templateId: record.templateId,
    templateVersion: record.templateVersion,
    status: record.status,
    items: record.items.map(mapItem),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

@Injectable()
export class ChecklistsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly repository: ChecklistsRepository,
    private readonly cases: CasesService,
    private readonly audit: AuditService,
  ) {}

  async listTemplates(
    actor: ActorContext,
    caseId: string,
    metadata: RequestAuditMetadata,
  ): Promise<ChecklistTemplateResponseDto[]> {
    await this.cases.assertAccessibleForFileResources(actor, caseId, metadata, 'CHECKLISTS');
    return (await this.repository.listTemplatesForCase(actor.organizationId, caseId)).map(
      mapTemplate,
    );
  }

  async list(
    actor: ActorContext,
    caseId: string,
    metadata: RequestAuditMetadata,
  ): Promise<CaseChecklistResponseDto[]> {
    await this.cases.assertAccessibleForFileResources(actor, caseId, metadata, 'CHECKLISTS');
    return (await this.repository.listCaseChecklists(actor.organizationId, caseId)).map(
      mapChecklist,
    );
  }

  async apply(
    actor: ActorContext,
    caseId: string,
    input: ApplyChecklistRequestDto,
    metadata: RequestAuditMetadata,
  ): Promise<CaseChecklistResponseDto> {
    await this.cases.assertAccessibleForFileResources(actor, caseId, metadata, 'CHECKLISTS');
    try {
      const result = await withTransaction(this.database.client, async (transaction) => {
        const applied = await this.repository.apply(
          transaction,
          actor.organizationId,
          caseId,
          input.templateId,
        );
        if (applied.created) {
          await this.audit.recordDomainInTransaction(transaction, {
            organizationId: actor.organizationId,
            userId: actor.userId,
            entityId: applied.record.id,
            entityType: 'case_checklist',
            action: 'checklist.applied',
            newData: {
              caseId,
              templateId: applied.record.templateId,
              templateVersion: applied.record.templateVersion,
              itemCount: applied.record.items.length,
            },
            ...metadata,
          });
        }
        return applied.record;
      });
      return mapChecklist(result);
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.message === 'CASE_NOT_FOUND' || error.message === 'CHECKLIST_TEMPLATE_NOT_FOUND')
      ) {
        throw this.#notFound();
      }
      throw error;
    }
  }

  async updateItem(
    actor: ActorContext,
    id: string,
    input: UpdateChecklistItemRequestDto,
    metadata: RequestAuditMetadata,
  ): Promise<CaseChecklistItemResponseDto> {
    const changedFields = Object.keys(input).sort();
    if (changedFields.length === 0) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'Dados inválidos.', [
        { field: 'body', code: 'notEmpty', message: 'Informe ao menos um campo para atualização.' },
      ]);
    }
    const current = await this.repository.findItem(actor.organizationId, id);
    if (current === null) {
      throw this.#notFound();
    }
    await this.cases.assertAccessibleForFileResources(
      actor,
      current.caseId,
      metadata,
      'CHECKLISTS',
    );
    const status = input.status ?? current.status;
    let documentId = input.documentId === undefined ? current.documentId : input.documentId;
    if (status === 'MISSING' || status === 'NOT_APPLICABLE') {
      if (input.documentId !== undefined && input.documentId !== null) {
        throw new ApiException(
          HttpStatus.BAD_REQUEST,
          'INVALID_CHECKLIST_DOCUMENT',
          'O status informado não aceita documento vinculado.',
        );
      }
      documentId = null;
    }
    if (documentRequiredStatuses.has(status) && documentId === null) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'CHECKLIST_DOCUMENT_REQUIRED',
        'O status informado exige um documento do mesmo caso.',
      );
    }
    const reviewed = humanReviewedStatuses.has(status);
    const updated = await withTransaction(this.database.client, async (transaction) => {
      if (
        documentId !== null &&
        !(await this.repository.documentExists(
          transaction,
          actor.organizationId,
          current.caseId,
          documentId,
        ))
      ) {
        throw new ApiException(
          HttpStatus.BAD_REQUEST,
          'INVALID_CHECKLIST_DOCUMENT',
          'O documento não pertence ao mesmo caso autorizado.',
        );
      }
      const result = await this.repository.updateItem(transaction, actor.organizationId, id, {
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.documentId === undefined && documentId === current.documentId
          ? {}
          : { documentId }),
        ...(input.notes === undefined ? {} : { notes: input.notes }),
        validatedById: reviewed ? actor.userId : null,
        validatedAt: reviewed ? new Date() : null,
      });
      if (result === null) {
        throw this.#notFound();
      }
      await this.repository.refreshChecklistStatus(
        transaction,
        actor.organizationId,
        current.caseId,
        current.caseChecklistId,
      );
      await this.audit.recordDomainInTransaction(transaction, {
        organizationId: actor.organizationId,
        userId: actor.userId,
        entityId: id,
        entityType: 'case_checklist_item',
        action: 'checklist_item.updated',
        oldData: { status: current.status, documentId: current.documentId },
        newData: {
          status: result.status,
          documentId: result.documentId,
          validatedById: result.validatedById,
          changedFields,
        },
        ...metadata,
      });
      return result;
    });
    return mapItem(updated);
  }

  async getTaskSource(
    actor: ActorContext,
    id: string,
    metadata: RequestAuditMetadata,
  ): Promise<{ sourceId: string; caseId: string; title: string; description: string | null }> {
    const item = await this.repository.findItem(actor.organizationId, id);
    if (item === null) {
      throw this.#notFound();
    }
    await this.cases.assertAccessibleForFileResources(actor, item.caseId, metadata, 'TASKS');
    if (!taskableStatuses.has(item.status)) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'CHECKLIST_ITEM_NOT_PENDING',
        'O item não está pendente para criação de tarefa.',
      );
    }
    return {
      sourceId: item.id,
      caseId: item.caseId,
      title: item.titleSnapshot,
      description: item.descriptionSnapshot,
    };
  }

  #notFound(): ApiException {
    return new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Recurso não encontrado.');
  }
}
