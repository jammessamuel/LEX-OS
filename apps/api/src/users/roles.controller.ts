import { Controller, Get, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { RequirePermissions } from '../access-control/require-permissions.decorator.js';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { ApiErrorEnvelopeDto } from '../http/error-envelope.dto.js';
import { RoleGrantService } from './role-grant.service.js';

@ApiTags('Papéis')
@ApiBearerAuth('access-token')
@Controller('roles')
export class RolesController {
  constructor(private readonly grants: RoleGrantService) {}

  /**
   * Exige `users.manage`, e não `roles.read`: o catálogo existe para quem atribui papel a
   * uma pessoa. `roles.read` fica reservado para a administração dos próprios papéis, que
   * ainda não existe.
   */
  @Get()
  @RequirePermissions('users.manage')
  @ApiOperation({
    summary: 'Lista os papéis atribuíveis com o que cada um permite.',
    description:
      'Cada papel vem com as permissões dele em texto legível e com `grantable`, que diz se ' +
      'quem pergunta pode concedê-lo. Papel não concedível é devolvido mesmo assim, para a ' +
      'interface poder explicar a ausência em vez de esconder a opção.',
  })
  @ApiUnauthorizedResponse({ type: ApiErrorEnvelopeDto })
  @ApiForbiddenResponse({ type: ApiErrorEnvelopeDto })
  list(@Req() request: AuthenticatedRequest) {
    if (request.actor === undefined) {
      throw new Error('Authenticated actor was not attached by the access-token guard.');
    }
    return this.grants.listAssignable(request.actor.organizationId, request.actor.userId);
  }
}
