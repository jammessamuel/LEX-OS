import { Injectable } from '@nestjs/common';
import { Prisma, type ChecklistStatus, type TransactionClient } from '@lex-os/database';

import { DatabaseService } from '../database/database.service.js';

const checklistTemplateSelect = {
  id: true,
  name: true,
  legalArea: true,
  caseType: true,
  version: true,
  items: {
    orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
    select: {
      id: true,
      title: true,
      description: true,
      isRequired: true,
      sortOrder: true,
      documentTypeId: true,
      documentType: { select: { code: true } },
    },
  },
} satisfies Prisma.ChecklistTemplateSelect;

const caseChecklistSelect = {
  id: true,
  organizationId: true,
  caseId: true,
  templateId: true,
  templateVersion: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  items: {
    orderBy: [{ templateItem: { sortOrder: 'asc' as const } }, { id: 'asc' as const }],
    select: {
      id: true,
      organizationId: true,
      caseId: true,
      caseChecklistId: true,
      templateItemId: true,
      titleSnapshot: true,
      descriptionSnapshot: true,
      isRequiredSnapshot: true,
      status: true,
      documentId: true,
      validatedById: true,
      validatedAt: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.CaseChecklistSelect;

const checklistItemSelect = {
  id: true,
  organizationId: true,
  caseId: true,
  caseChecklistId: true,
  templateItemId: true,
  titleSnapshot: true,
  descriptionSnapshot: true,
  isRequiredSnapshot: true,
  status: true,
  documentId: true,
  validatedById: true,
  validatedAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CaseChecklistItemSelect;

export type ChecklistTemplateRecord = Prisma.ChecklistTemplateGetPayload<{
  select: typeof checklistTemplateSelect;
}>;
export type CaseChecklistRecord = Prisma.CaseChecklistGetPayload<{
  select: typeof caseChecklistSelect;
}>;
export type ChecklistItemRecord = Prisma.CaseChecklistItemGetPayload<{
  select: typeof checklistItemSelect;
}>;

@Injectable()
export class ChecklistsRepository {
  constructor(private readonly database: DatabaseService) {}

  async listTemplatesForCase(
    organizationId: string,
    caseId: string,
  ): Promise<ChecklistTemplateRecord[]> {
    const target = await this.database.client.case.findFirst({
      where: { id: caseId, organizationId, deletedAt: null },
      select: { legalArea: true, caseType: true },
    });
    if (target === null) {
      return [];
    }
    return this.database.client.checklistTemplate.findMany({
      where: {
        legalArea: target.legalArea,
        caseType: target.caseType,
        isActive: true,
        OR: [{ organizationId: null }, { organizationId }],
      },
      orderBy: [{ version: 'desc' }, { id: 'asc' }],
      select: checklistTemplateSelect,
    });
  }

  listCaseChecklists(organizationId: string, caseId: string): Promise<CaseChecklistRecord[]> {
    return this.database.client.caseChecklist.findMany({
      where: { organizationId, caseId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: caseChecklistSelect,
    });
  }

  async apply(
    transaction: TransactionClient,
    organizationId: string,
    caseId: string,
    templateId: string,
  ): Promise<{ record: CaseChecklistRecord; created: boolean }> {
    const target = await transaction.case.findFirst({
      where: { id: caseId, organizationId, deletedAt: null },
      select: { legalArea: true, caseType: true },
    });
    if (target === null) {
      throw new Error('CASE_NOT_FOUND');
    }
    const template = await transaction.checklistTemplate.findFirst({
      where: {
        id: templateId,
        legalArea: target.legalArea,
        caseType: target.caseType,
        isActive: true,
        OR: [{ organizationId: null }, { organizationId }],
      },
      select: checklistTemplateSelect,
    });
    if (template === null) {
      throw new Error('CHECKLIST_TEMPLATE_NOT_FOUND');
    }
    const existing = await transaction.caseChecklist.findUnique({
      where: {
        caseId_templateId_templateVersion: {
          caseId,
          templateId: template.id,
          templateVersion: template.version,
        },
      },
      select: { id: true },
    });
    const checklist = await transaction.caseChecklist.upsert({
      where: {
        caseId_templateId_templateVersion: {
          caseId,
          templateId: template.id,
          templateVersion: template.version,
        },
      },
      update: {},
      create: {
        organizationId,
        caseId,
        templateId: template.id,
        templateVersion: template.version,
        status: 'IN_PROGRESS',
      },
      select: { id: true },
    });
    const inserted = await transaction.caseChecklistItem.createMany({
      data: template.items.map((item) => ({
        organizationId,
        caseId,
        caseChecklistId: checklist.id,
        templateItemId: item.id,
        titleSnapshot: item.title,
        descriptionSnapshot: item.description,
        isRequiredSnapshot: item.isRequired,
        status: 'MISSING' as const,
      })),
      skipDuplicates: true,
    });
    const record = await transaction.caseChecklist.findFirst({
      where: { id: checklist.id, organizationId, caseId },
      select: caseChecklistSelect,
    });
    if (record === null) {
      throw new Error('CHECKLIST_NOT_FOUND_AFTER_APPLY');
    }
    return { record, created: existing === null && inserted.count > 0 };
  }

  findItem(organizationId: string, id: string): Promise<ChecklistItemRecord | null> {
    return this.database.client.caseChecklistItem.findFirst({
      where: { id, organizationId },
      select: checklistItemSelect,
    });
  }

  async documentExists(
    transaction: TransactionClient,
    organizationId: string,
    caseId: string,
    documentId: string,
  ): Promise<boolean> {
    return (
      (await transaction.document.findFirst({
        where: { id: documentId, organizationId, caseId, deletedAt: null },
        select: { id: true },
      })) !== null
    );
  }

  async updateItem(
    transaction: TransactionClient,
    organizationId: string,
    id: string,
    data: {
      status?: ChecklistStatus;
      documentId?: string | null;
      notes?: string | null;
      validatedById: string | null;
      validatedAt: Date | null;
    },
  ): Promise<ChecklistItemRecord | null> {
    const updated = await transaction.caseChecklistItem.updateMany({
      where: { id, organizationId },
      data,
    });
    if (updated.count !== 1) {
      return null;
    }
    return transaction.caseChecklistItem.findFirst({
      where: { id, organizationId },
      select: checklistItemSelect,
    });
  }

  async refreshChecklistStatus(
    transaction: TransactionClient,
    organizationId: string,
    caseId: string,
    caseChecklistId: string,
  ): Promise<void> {
    const pendingRequired = await transaction.caseChecklistItem.count({
      where: {
        organizationId,
        caseId,
        caseChecklistId,
        isRequiredSnapshot: true,
        status: { notIn: ['VALIDATED', 'NOT_APPLICABLE'] },
      },
    });
    await transaction.caseChecklist.updateMany({
      where: { id: caseChecklistId, organizationId, caseId },
      data: { status: pendingRequired === 0 ? 'COMPLETED' : 'NEEDS_REVIEW' },
    });
  }
}
