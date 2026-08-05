import { HttpStatus, Injectable } from '@nestjs/common';

import type { ActorContext } from '../auth/actor-context.js';
import { DatabaseService } from '../database/database.service.js';
import { ApiException } from '../http/api-exception.js';
import type { CurrentOrganizationResponseDto } from './dto/current-organization-response.dto.js';

@Injectable()
export class OrganizationsService {
  constructor(private readonly database: DatabaseService) {}

  async getCurrent(actor: ActorContext): Promise<CurrentOrganizationResponseDto> {
    const organization = await this.database.client.organization.findFirst({
      where: {
        id: actor.organizationId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: {
        id: true,
        legalName: true,
        tradeName: true,
        subscriptionPlan: true,
        status: true,
      },
    });

    if (organization === null || organization.status !== 'ACTIVE') {
      throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Recurso não encontrado.');
    }

    return {
      id: organization.id,
      legalName: organization.legalName,
      tradeName: organization.tradeName,
      subscriptionPlan: organization.subscriptionPlan,
      status: organization.status,
    };
  }
}
