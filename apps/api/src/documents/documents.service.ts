import { HttpStatus, Injectable } from '@nestjs/common';
import { withTransaction } from '@lex-os/database';

import { AuditService, type RequestAuditMetadata } from '../audit/audit.service.js';
import type { ActorContext } from '../auth/actor-context.js';
import { CasesService } from '../cases/cases.service.js';
import { DatabaseService } from '../database/database.service.js';
import { ApiException } from '../http/api-exception.js';
import { parseCalendarDate } from '../http/calendar-date.js';
import {
  createTimestampIdCursorParser,
  decodeCursor,
  encodeCursor,
  type CursorPage,
} from '../http/pagination.js';
import type { DocumentResponseDto } from './dto/document-response.dto.js';
import type { ListDocumentsQueryDto } from './dto/list-documents-query.dto.js';
import type { UpdateDocumentRequestDto } from './dto/update-document-request.dto.js';
import {
  DocumentsRepository,
  type DocumentCursor,
  type DocumentRecord,
  type UpdateDocumentData,
} from './documents.repository.js';

const parseDocumentCursor: (value: unknown) => DocumentCursor | undefined =
  createTimestampIdCursorParser('createdAt');

function mapDocument(record: DocumentRecord): DocumentResponseDto {
  return {
    id: record.id,
    caseId: record.caseId,
    fileId: record.fileId,
    documentTypeId: record.documentTypeId,
    title: record.title,
    description: record.description,
    documentDate: record.documentDate?.toISOString().slice(0, 10) ?? null,
    issuer: record.issuer,
    recipient: record.recipient,
    classificationStatus: record.classificationStatus,
    processingStatus: record.processingStatus,
    isOriginal: record.isOriginal,
    isSigned: record.isSigned,
    isLegible: record.isLegible,
    isDuplicate: record.isDuplicate,
    file: {
      filename: record.file.originalFilename,
      mimeType: record.file.mimeType,
      sizeBytes: Number(record.file.sizeBytes),
      virusScanStatus: record.file.virusScanStatus,
      status: record.file.status,
    },
    documentType: record.documentType,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export interface ProcessingDocumentTarget {
  id: string;
  caseId: string;
  fileId: string;
  fileStatus: string;
  virusScanStatus: string;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly repository: DocumentsRepository,
    private readonly cases: CasesService,
    private readonly audit: AuditService,
  ) {}

  async list(
    actor: ActorContext,
    caseId: string,
    query: ListDocumentsQueryDto,
    metadata: RequestAuditMetadata,
  ): Promise<CursorPage<DocumentResponseDto>> {
    await this.cases.assertAccessibleForFileResources(actor, caseId, metadata, 'DOCUMENTS');
    const cursor = decodeCursor(query.cursor, parseDocumentCursor);
    const rows = await this.repository.list(actor.organizationId, caseId, {
      ...(cursor === undefined ? {} : { cursor }),
      ...(query.documentTypeId === undefined ? {} : { documentTypeId: query.documentTypeId }),
      ...(query.processingStatus === undefined ? {} : { processingStatus: query.processingStatus }),
      take: query.limit + 1,
    });
    const hasNextPage = rows.length > query.limit;
    const pageRows = hasNextPage ? rows.slice(0, query.limit) : rows;
    const last = pageRows.at(-1);
    return {
      data: pageRows.map(mapDocument),
      pageInfo: {
        hasNextPage,
        nextCursor:
          hasNextPage && last !== undefined
            ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
            : null,
      },
    };
  }

  async get(
    actor: ActorContext,
    id: string,
    metadata: RequestAuditMetadata,
  ): Promise<DocumentResponseDto> {
    return mapDocument(await this.#findAccessible(actor, id, metadata));
  }

  async getProcessingTarget(
    actor: ActorContext,
    id: string,
    metadata: RequestAuditMetadata,
  ): Promise<ProcessingDocumentTarget> {
    const document = await this.#findAccessible(actor, id, metadata);
    if (document.caseId === null) {
      throw this.#notFound();
    }
    return {
      id: document.id,
      caseId: document.caseId,
      fileId: document.fileId,
      fileStatus: document.file.status,
      virusScanStatus: document.file.virusScanStatus,
    };
  }

  async update(
    actor: ActorContext,
    id: string,
    input: UpdateDocumentRequestDto,
    metadata: RequestAuditMetadata,
  ): Promise<DocumentResponseDto> {
    const changedFields = Object.keys(input).sort();
    if (changedFields.length === 0) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'Dados inválidos.', [
        { field: 'body', code: 'notEmpty', message: 'Informe ao menos um campo para atualização.' },
      ]);
    }
    await this.#findAccessible(actor, id, metadata);
    const now = new Date();
    const data: UpdateDocumentData = {
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.description === undefined ? {} : { description: input.description }),
      ...(input.documentDate === undefined
        ? {}
        : {
            documentDate:
              input.documentDate === null
                ? null
                : parseCalendarDate(input.documentDate, 'documentDate'),
          }),
      ...(input.issuer === undefined ? {} : { issuer: input.issuer }),
      ...(input.recipient === undefined ? {} : { recipient: input.recipient }),
      ...(input.isOriginal === undefined ? {} : { isOriginal: input.isOriginal }),
      ...(input.isSigned === undefined ? {} : { isSigned: input.isSigned }),
      ...(input.isLegible === undefined ? {} : { isLegible: input.isLegible }),
      ...(input.documentTypeId === undefined
        ? {}
        : {
            documentTypeId: input.documentTypeId,
            classificationStatus: input.documentTypeId === null ? 'PENDING' : 'CLASSIFIED',
            classifiedById: input.documentTypeId === null ? null : actor.userId,
            classifiedAt: input.documentTypeId === null ? null : now,
          }),
    };

    const updated = await withTransaction(this.database.client, async (transaction) => {
      if (
        input.documentTypeId !== undefined &&
        input.documentTypeId !== null &&
        !(await this.repository.documentTypeIsVisible(
          transaction,
          actor.organizationId,
          input.documentTypeId,
        ))
      ) {
        throw new ApiException(
          HttpStatus.BAD_REQUEST,
          'INVALID_DOCUMENT_TYPE',
          'Tipo documental inválido.',
        );
      }
      const result = await this.repository.update(transaction, actor.organizationId, id, data);
      if (result === null) {
        throw this.#notFound();
      }
      await this.audit.recordDomainInTransaction(transaction, {
        organizationId: actor.organizationId,
        userId: actor.userId,
        entityId: result.id,
        entityType: 'document',
        action: 'document.updated',
        newData: {
          changedFields,
          documentTypeId: result.documentTypeId,
          classificationStatus: result.classificationStatus,
        },
        ...metadata,
      });
      return result;
    });
    return mapDocument(updated);
  }

  /**
   * Exclusão lógica do documento.
   *
   * A retenção do caso alcança o que está dentro dele. O filtro do repositório é quem impede;
   * esta consulta existe para a mensagem dizer que há retenção, e qual o motivo.
   */
  async remove(actor: ActorContext, id: string, metadata: RequestAuditMetadata): Promise<void> {
    const current = await this.#findAccessible(actor, id, metadata);
    if (current.caseId === null) {
      throw this.#notFound();
    }
    const caseId = current.caseId;
    await this.cases.assertNotUnderLegalHold(actor.organizationId, caseId);
    await withTransaction(this.database.client, async (transaction) => {
      const removed = await this.repository.softDelete(
        transaction,
        actor.organizationId,
        current.id,
        current.fileId,
        new Date(),
      );
      if (!removed) {
        throw this.#notFound();
      }
      await this.audit.recordDomainInTransaction(transaction, {
        organizationId: actor.organizationId,
        userId: actor.userId,
        entityId: current.id,
        entityType: 'document',
        action: 'document.deleted',
        newData: { caseId, fileId: current.fileId, softDeleted: true },
        ...metadata,
      });
    });
  }

  async #findAccessible(
    actor: ActorContext,
    id: string,
    metadata: RequestAuditMetadata,
  ): Promise<DocumentRecord> {
    const document = await this.repository.findById(actor.organizationId, id);
    if (document === null || document.caseId === null) {
      throw this.#notFound();
    }
    await this.cases.assertAccessibleForFileResources(
      actor,
      document.caseId,
      metadata,
      'DOCUMENTS',
    );
    return document;
  }

  #notFound(): ApiException {
    return new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Recurso não encontrado.');
  }
}
