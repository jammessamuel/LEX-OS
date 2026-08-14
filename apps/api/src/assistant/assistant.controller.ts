import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
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
import { AssistantService } from './assistant.service.js';
import { GroundedAnswerRequestDto } from './dto/grounded-answer-request.dto.js';
import { GroundedAnswerResponseDto } from './dto/grounded-answer-response.dto.js';

@ApiTags('Assistente ancorado')
@ApiBearerAuth('access-token')
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('answers')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('knowledge.search')
  @ApiOperation({
    summary: 'Responde somente com afirmações ligadas a fontes autorizadas do caso.',
  })
  @ApiOkResponse({ type: GroundedAnswerResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  @ApiBadGatewayResponse({ type: ApiErrorEnvelopeDto })
  answer(@Req() request: AuthenticatedRequest, @Body() input: GroundedAnswerRequestDto) {
    if (request.actor === undefined) {
      throw new Error('Authenticated actor was not attached by the access-token guard.');
    }
    return this.assistant.answer(request.actor, input, getRequestContext() ?? {});
  }
}
