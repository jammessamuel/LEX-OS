import { Injectable } from '@nestjs/common';

import { AuditService, type RequestAuditMetadata } from '../audit/audit.service.js';
import type { ActorContext } from '../auth/actor-context.js';
import { DashboardRepository } from './dashboard.repository.js';
import type { DashboardSummaryResponseDto } from './dto/dashboard-summary-response.dto.js';

@Injectable()
export class DashboardService {
  constructor(
    private readonly repository: DashboardRepository,
    private readonly audit: AuditService,
  ) {}

  async summarize(
    actor: ActorContext,
    metadata: RequestAuditMetadata,
  ): Promise<DashboardSummaryResponseDto> {
    const canReadConfidential = actor.permissions.has('confidential_cases.read');
    const result = await this.repository.summarize(actor.organizationId, canReadConfidential);

    if (canReadConfidential && result.confidentialCaseCount > 0) {
      await this.audit.recordDomain({
        organizationId: actor.organizationId,
        userId: actor.userId,
        entityId: null,
        entityType: 'case',
        action: 'case.confidential.read',
        newData: { access: 'DASHBOARD', count: result.confidentialCaseCount },
        ...metadata,
      });
    }

    return {
      cases: result.cases,
      documents: result.documents,
      tasks: result.tasks,
      processing: result.processing,
      asOf: result.asOf.toISOString(),
    };
  }
}
