import { Injectable } from '@nestjs/common';
import { Prisma } from '@lex-os/database';

import { DatabaseService } from '../database/database.service.js';

const assignableUserSelect = {
  id: true,
  name: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type AssignableUserRecord = Prisma.UserGetPayload<{
  select: typeof assignableUserSelect;
}>;

export interface AssignableUserCursor {
  createdAt: Date;
  id: string;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly database: DatabaseService) {}

  listAssignable(
    organizationId: string,
    input: { cursor?: AssignableUserCursor; take: number },
  ): Promise<AssignableUserRecord[]> {
    return this.database.client.user.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
        deletedAt: null,
        ...(input.cursor === undefined
          ? {}
          : {
              OR: [
                { createdAt: { gt: input.cursor.createdAt } },
                { createdAt: input.cursor.createdAt, id: { gt: input.cursor.id } },
              ],
            }),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: input.take,
      select: assignableUserSelect,
    });
  }
}
