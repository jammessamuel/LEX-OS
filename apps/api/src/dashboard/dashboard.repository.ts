import { Injectable } from '@nestjs/common';
import { Prisma } from '@lex-os/database';

import { DatabaseService } from '../database/database.service.js';

interface DashboardAggregateRow {
  caseTotal: bigint;
  caseOpen: bigint;
  caseHighPriority: bigint;
  caseProcessingLimitReached: bigint;
  confidentialCaseCount: bigint;
  documentTotal: bigint;
  documentProcessing: bigint;
  documentNeedsReview: bigint;
  documentFailed: bigint;
  taskOpen: bigint;
  taskOverdue: bigint;
  processingActive: bigint;
  processingFailed: bigint;
  asOf: Date;
}

export interface DashboardAggregates {
  cases: {
    total: number;
    open: number;
    highPriority: number;
    processingLimitReached: number;
  };
  documents: { total: number; processing: number; needsReview: number; failed: number };
  tasks: { open: number; overdue: number };
  processing: { active: number; failed: number };
  confidentialCaseCount: number;
  asOf: Date;
}

@Injectable()
export class DashboardRepository {
  constructor(private readonly database: DatabaseService) {}

  async summarize(
    organizationId: string,
    canReadConfidential: boolean,
  ): Promise<DashboardAggregates> {
    const rows = await this.database.client.$queryRaw<DashboardAggregateRow[]>(Prisma.sql`
      WITH accessible_cases AS (
        SELECT c.id,
               c.status,
               c.priority,
               c.confidentiality_level,
               c.processing_budget_status
        FROM cases c
        WHERE c.organization_id = ${organizationId}::uuid
          AND c.deleted_at IS NULL
          AND (${canReadConfidential}::boolean OR c.confidentiality_level = 'STANDARD')
      ),
      case_counts AS (
        SELECT count(*) AS case_total,
               count(*) FILTER (WHERE status NOT IN ('CLOSED', 'ARCHIVED')) AS case_open,
               count(*) FILTER (
                 WHERE status NOT IN ('CLOSED', 'ARCHIVED') AND priority IN ('HIGH', 'URGENT')
               ) AS case_high_priority,
               count(*) FILTER (
                 WHERE processing_budget_status = 'LIMIT_REACHED'
               ) AS case_processing_limit_reached,
               count(*) FILTER (
                 WHERE confidentiality_level <> 'STANDARD'
               ) AS confidential_case_count
        FROM accessible_cases
      ),
      document_counts AS (
        SELECT count(*) AS document_total,
               count(*) FILTER (
                 WHERE d.processing_status IN ('PENDING', 'QUEUED', 'PROCESSING')
               ) AS document_processing,
               count(*) FILTER (
                 WHERE d.processing_status = 'NEEDS_REVIEW'
               ) AS document_needs_review,
               count(*) FILTER (
                 WHERE d.processing_status = 'FAILED'
               ) AS document_failed
        FROM documents d
        INNER JOIN accessible_cases c ON c.id = d.case_id
        WHERE d.organization_id = ${organizationId}::uuid
          AND d.deleted_at IS NULL
      ),
      task_counts AS (
        SELECT count(*) FILTER (
                 WHERE t.status IN ('OPEN', 'IN_PROGRESS')
               ) AS task_open,
               count(*) FILTER (
                 WHERE t.status IN ('OPEN', 'IN_PROGRESS')
                   AND t.due_at < CURRENT_TIMESTAMP
               ) AS task_overdue
        FROM tasks t
        INNER JOIN accessible_cases c ON c.id = t.case_id
        WHERE t.organization_id = ${organizationId}::uuid
          AND t.deleted_at IS NULL
      ),
      processing_counts AS (
        SELECT count(*) FILTER (
                 WHERE p.status IN ('QUEUED', 'PROCESSING', 'RETRYING')
               ) AS processing_active,
               count(*) FILTER (WHERE p.status = 'FAILED') AS processing_failed
        FROM processing_jobs p
        INNER JOIN accessible_cases c ON c.id = p.case_id
        WHERE p.organization_id = ${organizationId}::uuid
      )
      SELECT cc.case_total AS "caseTotal",
             cc.case_open AS "caseOpen",
             cc.case_high_priority AS "caseHighPriority",
             cc.case_processing_limit_reached AS "caseProcessingLimitReached",
             cc.confidential_case_count AS "confidentialCaseCount",
             dc.document_total AS "documentTotal",
             dc.document_processing AS "documentProcessing",
             dc.document_needs_review AS "documentNeedsReview",
             dc.document_failed AS "documentFailed",
             tc.task_open AS "taskOpen",
             tc.task_overdue AS "taskOverdue",
             pc.processing_active AS "processingActive",
             pc.processing_failed AS "processingFailed",
             CURRENT_TIMESTAMP AS "asOf"
      FROM case_counts cc
      CROSS JOIN document_counts dc
      CROSS JOIN task_counts tc
      CROSS JOIN processing_counts pc
    `);
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Dashboard aggregate query did not return a row.');
    }

    return {
      cases: {
        total: Number(row.caseTotal),
        open: Number(row.caseOpen),
        highPriority: Number(row.caseHighPriority),
        processingLimitReached: Number(row.caseProcessingLimitReached),
      },
      documents: {
        total: Number(row.documentTotal),
        processing: Number(row.documentProcessing),
        needsReview: Number(row.documentNeedsReview),
        failed: Number(row.documentFailed),
      },
      tasks: { open: Number(row.taskOpen), overdue: Number(row.taskOverdue) },
      processing: {
        active: Number(row.processingActive),
        failed: Number(row.processingFailed),
      },
      confidentialCaseCount: Number(row.confidentialCaseCount),
      asOf: row.asOf,
    };
  }
}
