import { HttpStatus, Injectable } from '@nestjs/common';
import { withTransaction } from '@lex-os/database';

import { AuditService, type RequestAuditMetadata } from '../audit/audit.service.js';
import type { ActorContext } from '../auth/actor-context.js';
import { CasesService } from '../cases/cases.service.js';
import type { PersonCaseListResponseDto } from '../cases/dto/person-case-response.dto.js';
import { DatabaseService } from '../database/database.service.js';
import { ApiException } from '../http/api-exception.js';
import {
  createTimestampIdCursorParser,
  decodeCursor,
  encodeCursor,
  type CursorPage,
} from '../http/pagination.js';
import type { CreatePersonRequestDto } from './dto/create-person-request.dto.js';
import type { ListPersonsQueryDto } from './dto/list-persons-query.dto.js';
import type { ListPersonCasesQueryDto } from './dto/list-person-cases-query.dto.js';
import type { PersonResponseDto } from './dto/person-response.dto.js';
import type { UpdatePersonRequestDto } from './dto/update-person-request.dto.js';
import { maskCnpj, maskCpf, maskRg } from './identifiers.js';
import type { PersonTypeCode } from './person.constants.js';
import {
  PersonsRepository,
  type PersonCursor,
  type PersonRecord,
  type UpdatePersonData,
} from './persons.repository.js';

const parsePersonCursor: (value: unknown) => PersonCursor | undefined =
  createTimestampIdCursorParser('createdAt');

function asDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }
  return new Date(`${value}T00:00:00.000Z`);
}

function mapPerson(person: PersonRecord): PersonResponseDto {
  return {
    id: person.id,
    personType: person.personType,
    fullName: person.fullName,
    tradeName: person.tradeName,
    cpf: maskCpf(person.cpf),
    cnpj: maskCnpj(person.cnpj),
    rg: maskRg(person.rg),
    birthDate: person.birthDate?.toISOString().slice(0, 10) ?? null,
    email: person.email,
    phone: person.phone,
    occupation: person.occupation,
    maritalStatus: person.maritalStatus,
    createdAt: person.createdAt.toISOString(),
    updatedAt: person.updatedAt.toISOString(),
  };
}

@Injectable()
export class PersonsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly repository: PersonsRepository,
    private readonly audit: AuditService,
    private readonly cases: CasesService,
  ) {}

  async list(
    actor: ActorContext,
    query: ListPersonsQueryDto,
  ): Promise<CursorPage<PersonResponseDto>> {
    const cursor = decodeCursor(query.cursor, parsePersonCursor);
    const rows = await this.repository.list(actor.organizationId, {
      ...(query.personType === undefined ? {} : { personType: query.personType }),
      ...(cursor === undefined ? {} : { cursor }),
      take: query.limit + 1,
    });
    const hasNextPage = rows.length > query.limit;
    const pageRows = hasNextPage ? rows.slice(0, query.limit) : rows;
    const last = pageRows.at(-1);

    return {
      data: pageRows.map(mapPerson),
      pageInfo: {
        hasNextPage,
        nextCursor:
          hasNextPage && last !== undefined
            ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
            : null,
      },
    };
  }

  async get(actor: ActorContext, id: string): Promise<PersonResponseDto> {
    const person = await this.repository.findById(actor.organizationId, id);
    if (person === null) {
      throw this.#notFound();
    }
    return mapPerson(person);
  }

  async listCases(
    actor: ActorContext,
    id: string,
    query: ListPersonCasesQueryDto,
    metadata: RequestAuditMetadata,
  ): Promise<PersonCaseListResponseDto> {
    await this.assertAvailable(actor, id);
    return this.cases.listForPerson(actor, id, query, metadata);
  }

  async assertAvailable(actor: ActorContext, id: string): Promise<void> {
    const person = await this.repository.findById(actor.organizationId, id);
    if (person === null) {
      throw this.#notFound();
    }
  }

  async create(
    actor: ActorContext,
    input: CreatePersonRequestDto,
    metadata: RequestAuditMetadata,
  ): Promise<PersonResponseDto> {
    this.#assertDocumentCompatibility(input.personType, input.cpf ?? null, input.cnpj ?? null);
    const person = await withTransaction(this.database.client, async (transaction) => {
      const created = await this.repository.create(transaction, {
        organizationId: actor.organizationId,
        personType: input.personType,
        fullName: input.fullName,
        tradeName: input.tradeName ?? null,
        cpf: input.cpf ?? null,
        cnpj: input.cnpj ?? null,
        rg: input.rg ?? null,
        birthDate: asDate(input.birthDate) ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        occupation: input.occupation ?? null,
        maritalStatus: input.maritalStatus ?? null,
      });
      await this.audit.recordDomainInTransaction(transaction, {
        organizationId: actor.organizationId,
        userId: actor.userId,
        entityId: created.id,
        entityType: 'person',
        action: 'person.created',
        newData: { personType: created.personType },
        ...metadata,
      });
      return created;
    });
    return mapPerson(person);
  }

  async update(
    actor: ActorContext,
    id: string,
    input: UpdatePersonRequestDto,
    metadata: RequestAuditMetadata,
  ): Promise<PersonResponseDto> {
    const changedFields = Object.keys(input).sort();
    if (changedFields.length === 0) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'Dados inválidos.', [
        { field: 'body', code: 'notEmpty', message: 'Informe ao menos um campo para atualização.' },
      ]);
    }

    const current = await this.repository.findById(actor.organizationId, id);
    if (current === null) {
      throw this.#notFound();
    }
    const personType = input.personType ?? current.personType;
    const cpf = input.cpf === undefined ? current.cpf : input.cpf;
    const cnpj = input.cnpj === undefined ? current.cnpj : input.cnpj;
    this.#assertDocumentCompatibility(personType, cpf, cnpj);

    const data: UpdatePersonData = {
      ...(input.personType === undefined ? {} : { personType: input.personType }),
      ...(input.fullName === undefined ? {} : { fullName: input.fullName }),
      ...(input.tradeName === undefined ? {} : { tradeName: input.tradeName }),
      ...(input.cpf === undefined ? {} : { cpf: input.cpf }),
      ...(input.cnpj === undefined ? {} : { cnpj: input.cnpj }),
      ...(input.rg === undefined ? {} : { rg: input.rg }),
      ...(input.birthDate === undefined
        ? {}
        : {
            birthDate:
              input.birthDate === null ? null : new Date(`${input.birthDate}T00:00:00.000Z`),
          }),
      ...(input.email === undefined ? {} : { email: input.email }),
      ...(input.phone === undefined ? {} : { phone: input.phone }),
      ...(input.occupation === undefined ? {} : { occupation: input.occupation }),
      ...(input.maritalStatus === undefined ? {} : { maritalStatus: input.maritalStatus }),
    };
    const updated = await withTransaction(this.database.client, async (transaction) => {
      const result = await this.repository.update(transaction, actor.organizationId, id, data);
      if (result === null) {
        throw this.#notFound();
      }
      await this.audit.recordDomainInTransaction(transaction, {
        organizationId: actor.organizationId,
        userId: actor.userId,
        entityId: result.id,
        entityType: 'person',
        action: 'person.updated',
        newData: { changedFields },
        ...metadata,
      });
      return result;
    });
    return mapPerson(updated);
  }

  async remove(actor: ActorContext, id: string, metadata: RequestAuditMetadata): Promise<void> {
    const current = await this.repository.findById(actor.organizationId, id);
    if (current === null) {
      throw this.#notFound();
    }
    // A recusa por retenção precisa de mensagem própria: "não encontrado" mandaria o
    // advogado procurar um defeito que não existe.
    await this.repository.assertNotInHeldCase(actor.organizationId, id);
    await withTransaction(this.database.client, async (transaction) => {
      const removed = await this.repository.softDelete(
        transaction,
        actor.organizationId,
        id,
        new Date(),
      );
      if (!removed) {
        throw this.#notFound();
      }
      await this.audit.recordDomainInTransaction(transaction, {
        organizationId: actor.organizationId,
        userId: actor.userId,
        entityId: id,
        entityType: 'person',
        action: 'person.deleted',
        newData: { softDeleted: true },
        ...metadata,
      });
    });
  }

  #assertDocumentCompatibility(
    personType: PersonTypeCode,
    cpf: string | null,
    cnpj: string | null,
  ): void {
    const incompatible =
      (cpf !== null && personType !== 'INDIVIDUAL') ||
      (cnpj !== null && personType === 'INDIVIDUAL') ||
      (cpf !== null && cnpj !== null);

    if (incompatible) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'Dados inválidos.', [
        {
          field: 'personType',
          code: 'personDocumentCompatibility',
          message: 'O documento informado não corresponde ao tipo de pessoa.',
        },
      ]);
    }
  }

  #notFound(): ApiException {
    return new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Recurso não encontrado.');
  }
}
