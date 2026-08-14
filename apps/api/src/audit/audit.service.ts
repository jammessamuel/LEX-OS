import { Injectable } from '@nestjs/common';
import { Prisma, type TransactionClient } from '@lex-os/database';

import { DatabaseService } from '../database/database.service.js';

export type AuthenticationAuditAction =
  | 'auth.login.blocked'
  | 'auth.login.failed'
  | 'auth.login.succeeded'
  | 'auth.logout.succeeded'
  | 'auth.refresh.replayed'
  | 'auth.refresh.revoked'
  | 'auth.refresh.succeeded';

export interface AuthenticationAuditEvent {
  organizationId: string;
  userId?: string;
  sessionId?: string;
  action: AuthenticationAuditAction;
  outcome: 'DENIED' | 'SUCCEEDED';
  reason?: 'BLOCKED_USER' | 'EXPIRED' | 'INVALID_CREDENTIALS' | 'LOGOUT' | 'REPLAY_DETECTED';
  requestId?: string;
  correlationId?: string;
  authenticatedActor: boolean;
}

export interface RequestAuditMetadata {
  requestId?: string;
  correlationId?: string;
}

interface DomainAuditBase extends RequestAuditMetadata {
  organizationId: string;
  userId: string;
  entityId: string | null;
}

export interface CaseAuditSnapshot {
  status: string;
  priority: string;
  confidentialityLevel: string;
  responsibleUserId: string | null;
}

export type DomainAuditEvent =
  | (DomainAuditBase & {
      action: 'person.created';
      entityType: 'person';
      newData: { personType: string };
    })
  | (DomainAuditBase & {
      action: 'person.updated';
      entityType: 'person';
      newData: { changedFields: string[] };
    })
  | (DomainAuditBase & {
      action: 'person.deleted';
      entityType: 'person';
      newData: { softDeleted: true };
    })
  | (DomainAuditBase & {
      action: 'user.assignable.listed';
      entityType: 'user';
      newData: { count: number };
    })
  | (DomainAuditBase & {
      action: 'case.created';
      entityType: 'case';
      newData: CaseAuditSnapshot;
    })
  | (DomainAuditBase & {
      action: 'case.updated';
      entityType: 'case';
      oldData: CaseAuditSnapshot;
      newData: CaseAuditSnapshot & { changedFields: string[] };
    })
  | (DomainAuditBase & {
      action: 'case.deleted';
      entityType: 'case';
      oldData: CaseAuditSnapshot;
      newData: CaseAuditSnapshot & { softDeleted: true };
    })
  | (DomainAuditBase & {
      action: 'case.processing_budget.updated';
      entityType: 'case';
      oldData: { limitAmount: string; currency: string; status: string };
      newData: { limitAmount: string; currency: string; status: string };
    })
  | (DomainAuditBase & {
      action: 'case.confidential.read';
      entityType: 'case';
      newData: {
        access:
          | 'CHECKLISTS'
          | 'DASHBOARD'
          | 'DETAIL'
          | 'DOCUMENTS'
          | 'DOWNLOAD'
          | 'FILES'
          | 'LIST'
          | 'PARTICIPANTS'
          | 'PERSON_CASES'
          | 'PROCESSING'
          | 'SEARCH'
          | 'TASKS'
          | 'TIMELINE';
        count?: number;
      };
    })
  | (DomainAuditBase & {
      action: 'case_participant.created';
      entityType: 'case_participant';
      newData: {
        caseId: string;
        personId: string;
        role: string;
        side: string | null;
        isClient: boolean;
      };
    })
  | (DomainAuditBase & {
      action: 'file.uploaded';
      entityType: 'file';
      newData: {
        caseId: string;
        documentId: string;
        processingJobId: string;
        mimeType: string;
        sizeBytes: number;
        status: string;
        virusScanStatus: string;
        isDuplicate: boolean;
      };
    })
  | (DomainAuditBase & {
      action: 'file.duplicate.detected';
      entityType: 'file';
      newData: { caseId: string; documentId: string; duplicateOfFileId: string };
    })
  | (DomainAuditBase & {
      action: 'file.upload.rejected';
      entityType: 'file';
      newData: { caseId: string; fileIndex: number; reason: string };
    })
  | (DomainAuditBase & {
      action: 'file.upload.quarantined';
      entityType: 'file';
      newData: { caseId: string; documentId: string; reason: 'SCANNER_UNAVAILABLE' };
    })
  | (DomainAuditBase & {
      action: 'file.download_url.created';
      entityType: 'file';
      newData: { caseId: string; documentId: string; expiresInSeconds: number };
    })
  | (DomainAuditBase & {
      action: 'document.updated';
      entityType: 'document';
      newData: {
        changedFields: string[];
        documentTypeId: string | null;
        classificationStatus: string;
      };
    })
  | (DomainAuditBase & {
      action: 'document.deleted';
      entityType: 'document';
      newData: { caseId: string; fileId: string; softDeleted: true };
    })
  | (DomainAuditBase & {
      action: 'document.reprocessed';
      entityType: 'document';
      newData: { caseId: string; fileId: string; processingJobId: string; jobType: 'OCR' };
    })
  | (DomainAuditBase & {
      action: 'extracted_entity.confirmed';
      entityType: 'extracted_entity';
      oldData: { confirmedByUser: false };
      newData: { confirmedByUser: true; confirmedById: string; confirmedAt: string };
    })
  | (DomainAuditBase & {
      action: 'timeline.event.confirmed';
      entityType: 'timeline_event';
      oldData: { confirmedByUser: false };
      newData: { confirmedByUser: true; confirmedById: string; confirmedAt: string };
    })
  | (DomainAuditBase & {
      action: 'checklist.applied';
      entityType: 'case_checklist';
      newData: {
        caseId: string;
        templateId: string;
        templateVersion: number;
        itemCount: number;
      };
    })
  | (DomainAuditBase & {
      action: 'checklist_item.updated';
      entityType: 'case_checklist_item';
      oldData: { status: string; documentId: string | null };
      newData: {
        status: string;
        documentId: string | null;
        validatedById: string | null;
        changedFields: string[];
      };
    })
  | (DomainAuditBase & {
      action: 'task.created';
      entityType: 'task';
      newData: {
        caseId: string;
        sourceType: 'AI_CHECKLIST';
        sourceId: string;
        status: 'OPEN';
        priority: string;
        assignedToId: string | null;
      };
    })
  | (DomainAuditBase & {
      action: 'task.updated';
      entityType: 'task';
      oldData: {
        status: string;
        priority: string;
        assignedToId: string | null;
        dueAt: string | null;
        completedAt: string | null;
      };
      newData: {
        status: string;
        priority: string;
        assignedToId: string | null;
        dueAt: string | null;
        completedAt: string | null;
        changedFields: string[];
      };
    })
  | (DomainAuditBase & {
      action: 'knowledge.search.executed';
      entityType: 'knowledge_search';
      newData: {
        mode: 'HYBRID' | 'LEXICAL' | 'SEMANTIC';
        queryLength: number;
        resultCount: number;
        status: 'RESULTS' | 'INSUFFICIENT_EVIDENCE';
        filters: {
          caseId: string | null;
          documentId: string | null;
          documentTypeId: string | null;
          legalArea: string | null;
        };
      };
    })
  | (DomainAuditBase & {
      action: 'assistant.answer.refused';
      entityType: 'assistant_answer';
      newData: {
        caseId: string;
        questionLength: number;
        status: 'INSUFFICIENT_EVIDENCE';
      };
    })
  | (DomainAuditBase & {
      action: 'assistant.answer.generated';
      entityType: 'assistant_answer';
      newData: {
        caseId: string;
        questionLength: number;
        claimCount: number;
        sourceChunkIds: string[];
        provider: string;
        modelName: string;
        modelVersion: string;
        promptVersion: string;
        executionId: string;
        costAmount: string;
        costCurrency: string;
      };
    })
  | (DomainAuditBase & {
      action: 'audit.log.listed';
      entityType: 'audit_log';
      newData: {
        count: number;
        filters: {
          action: string | null;
          entityType: string | null;
          actorType: string | null;
          userId: string | null;
          entityId: string | null;
          from: string | null;
          to: string | null;
        };
      };
    });

function auditData(event: AuthenticationAuditEvent) {
  return {
    organizationId: event.organizationId,
    userId: event.userId ?? null,
    actorType: event.authenticatedActor ? ('USER' as const) : ('SYSTEM' as const),
    actorId:
      event.authenticatedActor && event.userId !== undefined ? event.userId : 'authentication',
    action: event.action,
    entityType: 'authentication_session',
    entityId: event.sessionId ?? null,
    newData: {
      outcome: event.outcome,
      ...(event.reason === undefined ? {} : { reason: event.reason }),
    },
    requestId: event.requestId ?? null,
    correlationId: event.correlationId ?? null,
  };
}

function domainAuditData(event: DomainAuditEvent) {
  return {
    organizationId: event.organizationId,
    userId: event.userId,
    actorType: 'USER' as const,
    actorId: event.userId,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    ...('oldData' in event ? { oldData: asInputJsonObject(event.oldData) } : {}),
    newData: asInputJsonObject(event.newData),
    requestId: event.requestId ?? null,
    correlationId: event.correlationId ?? null,
  };
}

function asInputJsonObject(value: object): Prisma.InputJsonObject {
  return { ...value } as Prisma.InputJsonObject;
}

@Injectable()
export class AuditService {
  constructor(private readonly database: DatabaseService) {}

  async recordAuthentication(event: AuthenticationAuditEvent): Promise<void> {
    await this.database.client.auditLog.create({ data: auditData(event) });
  }

  async recordAuthenticationInTransaction(
    transaction: TransactionClient,
    event: AuthenticationAuditEvent,
  ): Promise<void> {
    await transaction.auditLog.create({ data: auditData(event) });
  }

  async recordDomain(event: DomainAuditEvent): Promise<void> {
    await this.database.client.auditLog.create({ data: domainAuditData(event) });
  }

  async recordDomainInTransaction(
    transaction: TransactionClient,
    event: DomainAuditEvent,
  ): Promise<void> {
    await transaction.auditLog.create({ data: domainAuditData(event) });
  }
}
