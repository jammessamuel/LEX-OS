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
import { getRequestContext } from '../observability/request-context.js';
import { DashboardService } from './dashboard.service.js';
import { DashboardSummaryResponseDto } from './dto/dashboard-summary-response.dto.js';

@ApiTags('Painel')
@ApiBearerAuth('access-token')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  @RequirePermissions('cases.read', 'documents.read', 'tasks.read')
  @ApiOperation({ summary: 'Resume o trabalho acessível sem varrer páginas no cliente.' })
  @ApiOkResponse({ type: DashboardSummaryResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  summarize(@Req() request: AuthenticatedRequest) {
    if (request.actor === undefined) {
      throw new Error('Authenticated actor was not attached by the access-token guard.');
    }
    return this.dashboard.summarize(request.actor, getRequestContext() ?? {});
  }
}
