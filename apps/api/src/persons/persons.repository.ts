import { Injectable } from '@nestjs/common';
import { Prisma, type TransactionClient } from '@lex-os/database';

import { DatabaseService } from '../database/database.service.js';
import type { PersonTypeCode } from './person.constants.js';

const personSelect = {
  id: true,
  organizationId: true,
  personType: true,
  fullName: true,
  tradeName: true,
  cpf: true,
  cnpj: true,
  rg: true,
  birthDate: true,
  email: true,
  phone: true,
  occupation: true,
  maritalStatus: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PersonSelect;

export type PersonRecord = Prisma.PersonGetPayload<{ select: typeof personSelect }>;

export interface PersonCursor {
  createdAt: Date;
  id: string;
}

export interface CreatePersonData {
  organizationId: string;
  personType: PersonTypeCode;
  fullName: string;
  tradeName: string | null;
  cpf: string | null;
  cnpj: string | null;
  rg: string | null;
  birthDate: Date | null;
  email: string | null;
  phone: string | null;
  occupation: string | null;
  maritalStatus: string | null;
}

export interface UpdatePersonData {
  personType?: PersonTypeCode;
  fullName?: string;
  tradeName?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
  rg?: string | null;
  birthDate?: Date | null;
  email?: string | null;
  phone?: string | null;
  occupation?: string | null;
  maritalStatus?: string | null;
}

@Injectable()
export class PersonsRepository {
  constructor(private readonly database: DatabaseService) {}

  list(
    organizationId: string,
    input: { personType?: PersonTypeCode; cursor?: PersonCursor; take: number },
  ): Promise<PersonRecord[]> {
    const cursorFilter =
      input.cursor === undefined
        ? {}
        : {
            OR: [
              { createdAt: { lt: input.cursor.createdAt } },
              { createdAt: input.cursor.createdAt, id: { lt: input.cursor.id } },
            ],
          };

    return this.database.client.person.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(input.personType === undefined ? {} : { personType: input.personType }),
        ...cursorFilter,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.take,
      select: personSelect,
    });
  }

  findById(organizationId: string, id: string): Promise<PersonRecord | null> {
    return this.database.client.person.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: personSelect,
    });
  }

  create(transaction: TransactionClient, data: CreatePersonData): Promise<PersonRecord> {
    return transaction.person.create({ data, select: personSelect });
  }

  async update(
    transaction: TransactionClient,
    organizationId: string,
    id: string,
    data: UpdatePersonData,
  ): Promise<PersonRecord | null> {
    const result = await transaction.person.updateMany({
      where: { id, organizationId, deletedAt: null },
      data,
    });

    if (result.count !== 1) {
      return null;
    }

    return transaction.person.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: personSelect,
    });
  }

  async softDelete(
    transaction: TransactionClient,
    organizationId: string,
    id: string,
    occurredAt: Date,
  ): Promise<boolean> {
    // Pessoa que participa de caso sob retenção não sai das listas: apagá-la mudaria o que o
    // caso retido mostra, que é exatamente o que a retenção existe para impedir.
    const result = await transaction.person.updateMany({
      where: {
        id,
        organizationId,
        deletedAt: null,
        participations: { none: { case: { legalHoldAt: { not: null } } } },
      },
      data: { deletedAt: occurredAt },
    });
    return result.count === 1;
  }
}
