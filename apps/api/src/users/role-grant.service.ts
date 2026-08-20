import { HttpStatus, Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import { ApiException } from '../http/api-exception.js';

/**
 * Quem pode conceder o quê.
 *
 * A regra é sobre **permissão**, não sobre papel. Exigir que quem concede tenha o mesmo papel
 * impediria um administrador de criar um estagiário — o caso mais comum que existe. O que ele
 * não pode é conceder um papel que carregue permissão que ele próprio não tem, porque isso
 * transformaria `users.manage` em caminho de escalada para tudo.
 *
 * Vive em um serviço próprio porque convite e troca de papel precisam exatamente da mesma
 * regra, e duas cópias divergem no dia em que uma delas for ajustada.
 */
@Injectable()
export class RoleGrantService {
  constructor(private readonly database: DatabaseService) {}

  async assertGrantable(
    organizationId: string,
    granterUserId: string,
    roleIds: readonly string[],
  ): Promise<void> {
    if (roleIds.length === 0) {
      return;
    }

    const [granted, roles] = await Promise.all([
      this.#permissionsOf(organizationId, granterUserId),
      this.database.client.role.findMany({
        // Papel de outro escritório simplesmente não volta. A contagem detecta a ausência sem
        // que a resposta precise dizer que ele existe em algum lugar.
        where: {
          id: { in: [...roleIds] },
          OR: [{ organizationId: null }, { organizationId }],
        },
        select: {
          id: true,
          rolePermissions: { select: { permission: { select: { code: true } } } },
        },
      }),
    ]);

    const escalates = roles.some((role) =>
      role.rolePermissions.some((entry) => !granted.has(entry.permission.code)),
    );

    if (roles.length !== roleIds.length || escalates) {
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        'ROLE_NOT_GRANTABLE',
        'Você só pode conceder papéis cujas permissões você já possui neste escritório.',
        [{ field: 'roleIds', code: 'NOT_GRANTABLE', message: 'Papel indisponível.' }],
      );
    }
  }

  async #permissionsOf(organizationId: string, userId: string): Promise<Set<string>> {
    const rows = await this.database.client.rolePermission.findMany({
      where: {
        role: {
          OR: [{ organizationId: null }, { organizationId }],
          userRoles: { some: { userId } },
        },
      },
      select: { permission: { select: { code: true } } },
    });
    return new Set(rows.map((row) => row.permission.code));
  }
}
