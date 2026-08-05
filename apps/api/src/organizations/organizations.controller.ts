import { Controller, Get, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { RequirePermissions } from '../access-control/require-permissions.decorator.js';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { ApiErrorEnvelopeDto } from '../http/error-envelope.dto.js';
import { CurrentOrganizationResponseDto } from './dto/current-organization-response.dto.js';
import { OrganizationsService } from './organizations.service.js';

@ApiTags('Organizações')
@ApiBearerAuth('access-token')
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get('current')
  @RequirePermissions('organizations.read')
  @ApiOperation({ summary: 'Retorna a organização derivada da sessão autenticada.' })
  @ApiOkResponse({ type: CurrentOrganizationResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  async getCurrent(@Req() request: AuthenticatedRequest): Promise<CurrentOrganizationResponseDto> {
    if (request.actor === undefined) {
      throw new Error('Authenticated actor was not attached by the access-token guard.');
    }

    return this.organizations.getCurrent(request.actor);
  }
}
