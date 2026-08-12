import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
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
import { SearchRequestDto } from './dto/search-request.dto.js';
import { SearchResponseDto } from './dto/search-response.dto.js';
import { SearchService } from './search.service.js';

@ApiTags('Pesquisa')
@ApiBearerAuth('access-token')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('knowledge.search')
  @ApiOperation({
    summary: 'Pesquisa apenas fontes autorizadas e retorna citações resolvíveis.',
  })
  @ApiOkResponse({ type: SearchResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  search(@Req() request: AuthenticatedRequest, @Body() input: SearchRequestDto) {
    if (request.actor === undefined) {
      throw new Error('Authenticated actor was not attached by the access-token guard.');
    }
    return this.searchService.search(request.actor, input, getRequestContext() ?? {});
  }
}
