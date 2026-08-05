import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';

import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { RuntimeConfig } from '@lex-os/config';
import { withTransaction } from '@lex-os/database';
import busboy, { type FileInfo } from 'busboy';
import type { Request } from 'express';

import { AuditService, type RequestAuditMetadata } from '../audit/audit.service.js';
import type { ActorContext } from '../auth/actor-context.js';
import { CasesService } from '../cases/cases.service.js';
import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import { DatabaseService } from '../database/database.service.js';
import { ApiException } from '../http/api-exception.js';
import { decodeCursor, encodeCursor, type CursorPage } from '../http/pagination.js';
import { ProcessingQueuePublisher } from '../processing/processing-queue.publisher.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../storage/object-storage.js';
import type {
  AcceptedFileIntakeResponseDto,
  DownloadUrlResponseDto,
  FileIntakeBatchResponseDto,
  FileResponseDto,
  RejectedFileIntakeResponseDto,
} from './dto/file-response.dto.js';
import type { ListFilesQueryDto } from './dto/list-files-query.dto.js';
import { FileIntakeError } from './file-intake-error.js';
import {
  FileStreamInspector,
  supportedFileMimeTypes,
  type InspectedFile,
} from './file-stream-inspector.js';
import { sanitizeFilename, type SafeFilename } from './filename-policy.js';
import {
  FilesRepository,
  type CreatedIntakeResources,
  type FileCursor,
  type StoredFileListRecord,
} from './files.repository.js';
import { VIRUS_SCANNER, type VirusScanner } from './virus-scanner.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

interface StagedFile {
  fileIndex: number;
  storageKey: string;
  filename: SafeFilename;
  inspection: InspectedFile;
}

type StagedResult =
  | { accepted: true; staged: StagedFile }
  | { accepted: false; rejection: RejectedFileIntakeResponseDto; error: FileIntakeError };

function parseFileCursor(value: unknown): FileCursor | undefined {
  if (value === null || typeof value !== 'object') {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.createdAt !== 'string' ||
    Number.isNaN(Date.parse(candidate.createdAt)) ||
    typeof candidate.id !== 'string' ||
    !uuidPattern.test(candidate.id)
  ) {
    return undefined;
  }
  return { createdAt: new Date(candidate.createdAt), id: candidate.id };
}

function mapFile(record: StoredFileListRecord): FileResponseDto {
  const document = record.documents[0];
  if (document === undefined) {
    throw new Error('A listed file must have an active document.');
  }
  return {
    id: record.id,
    documentId: document.id,
    filename: record.originalFilename,
    mimeType: record.mimeType,
    extension: record.extension,
    sizeBytes: Number(record.sizeBytes),
    virusScanStatus: record.virusScanStatus,
    status: record.status,
    duplicateOfFileId: record.duplicateOfFileId,
    createdAt: record.createdAt.toISOString(),
  };
}

function mapCreatedIntake(resources: CreatedIntakeResources): AcceptedFileIntakeResponseDto {
  return {
    file: {
      id: resources.file.id,
      documentId: resources.document.id,
      filename: resources.file.originalFilename,
      mimeType: resources.file.mimeType,
      extension: resources.file.extension,
      sizeBytes: Number(resources.file.sizeBytes),
      virusScanStatus: resources.file.virusScanStatus,
      status: resources.file.status,
      duplicateOfFileId: resources.file.duplicateOfFileId,
      createdAt: resources.file.createdAt.toISOString(),
    },
    job: resources.job,
  };
}

@Injectable()
export class FilesService {
  readonly #allowedMimeTypes: ReadonlySet<string>;
  readonly #logger = new Logger(FilesService.name);

  constructor(
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(VIRUS_SCANNER) private readonly scanner: VirusScanner,
    private readonly database: DatabaseService,
    private readonly repository: FilesRepository,
    private readonly cases: CasesService,
    private readonly audit: AuditService,
    private readonly processingQueue: ProcessingQueuePublisher,
  ) {
    this.#allowedMimeTypes = new Set(config.fileIntake.allowedMimeTypes);
    const unsupported = config.fileIntake.allowedMimeTypes.filter(
      (mimeType) => !supportedFileMimeTypes.includes(mimeType),
    );
    if (unsupported.length > 0) {
      throw new Error('FILE_INTAKE_ALLOWED_MIME_TYPES contains unsupported values.');
    }
  }

  async upload(
    actor: ActorContext,
    caseId: string,
    request: Request,
    metadata: RequestAuditMetadata,
  ): Promise<FileIntakeBatchResponseDto> {
    await this.cases.assertAccessibleForFileResources(actor, caseId, metadata);
    let stagedResults: StagedResult[];
    try {
      stagedResults = await this.#parseAndStage(request);
    } catch (error: unknown) {
      if (error instanceof FileIntakeError) {
        await this.#auditRejection(actor, caseId, 0, error, metadata);
        throw new ApiException(error.statusCode, error.publicCode, error.publicMessage);
      }
      throw error;
    }
    const accepted: AcceptedFileIntakeResponseDto[] = [];
    const rejected: RejectedFileIntakeResponseDto[] = [];
    const rejectionErrors: FileIntakeError[] = [];

    for (const result of stagedResults) {
      if (!result.accepted) {
        rejected.push(result.rejection);
        rejectionErrors.push(result.error);
        await this.#auditRejection(
          actor,
          caseId,
          result.rejection.fileIndex,
          result.error,
          metadata,
        );
        continue;
      }

      try {
        accepted.push(await this.#persistStaged(actor, caseId, result.staged, metadata));
      } catch (error: unknown) {
        await this.#deleteObjectSafely(result.staged.storageKey);
        throw error;
      }
    }

    if (accepted.length === 0) {
      const first = rejectionErrors[0];
      if (first === undefined) {
        const missingFile = new FileIntakeError(
          'FILE_REQUIRED',
          HttpStatus.BAD_REQUEST,
          'FILE_REQUIRED',
          'Envie ao menos um arquivo.',
        );
        await this.#auditRejection(actor, caseId, 0, missingFile, metadata);
        throw new ApiException(
          missingFile.statusCode,
          missingFile.publicCode,
          missingFile.publicMessage,
        );
      }
      throw new ApiException(first.statusCode, first.publicCode, first.publicMessage);
    }

    return { accepted, rejected };
  }

  async list(
    actor: ActorContext,
    caseId: string,
    query: ListFilesQueryDto,
    metadata: RequestAuditMetadata,
  ): Promise<CursorPage<FileResponseDto>> {
    await this.cases.assertAccessibleForFileResources(actor, caseId, metadata, 'FILES');
    const cursor = decodeCursor(query.cursor, parseFileCursor);
    const rows = await this.repository.list(actor.organizationId, caseId, {
      ...(cursor === undefined ? {} : { cursor }),
      take: query.limit + 1,
    });
    const hasNextPage = rows.length > query.limit;
    const pageRows = hasNextPage ? rows.slice(0, query.limit) : rows;
    const last = pageRows.at(-1);
    return {
      data: pageRows.map(mapFile),
      pageInfo: {
        hasNextPage,
        nextCursor:
          hasNextPage && last !== undefined
            ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
            : null,
      },
    };
  }

  async createDownloadUrl(
    actor: ActorContext,
    fileId: string,
    metadata: RequestAuditMetadata,
  ): Promise<DownloadUrlResponseDto> {
    const file = await this.repository.findForDownload(actor.organizationId, fileId);
    const document = file?.documents[0];
    if (
      file === null ||
      document === undefined ||
      file.documents.some((linkedDocument) => linkedDocument.caseId === null)
    ) {
      throw this.#notFound();
    }
    const caseIds = [...new Set(file.documents.map((linkedDocument) => linkedDocument.caseId))];
    for (const linkedCaseId of caseIds) {
      if (linkedCaseId === null) {
        throw this.#notFound();
      }
      await this.cases.assertAccessibleForFileResources(actor, linkedCaseId, metadata, 'DOWNLOAD');
    }
    const primaryCaseId = document.caseId;
    if (primaryCaseId === null) {
      throw this.#notFound();
    }
    if (file.status !== 'AVAILABLE' || file.virusScanStatus !== 'CLEAN') {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'FILE_NOT_AVAILABLE',
        'O arquivo ainda não está disponível para download.',
      );
    }
    if (!(await this.storage.objectExists(file.storageBucket, file.storageKey))) {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'FILE_STORAGE_UNAVAILABLE',
        'O arquivo está temporariamente indisponível.',
      );
    }

    const expiresInSeconds = this.config.objectStorage.downloadUrlTtlSeconds;
    const url = await this.storage.createDownloadUrl({
      bucket: file.storageBucket,
      key: file.storageKey,
      filename: file.originalFilename,
      contentType: file.mimeType,
      expiresInSeconds,
    });
    await this.audit.recordDomain({
      organizationId: actor.organizationId,
      userId: actor.userId,
      entityId: file.id,
      entityType: 'file',
      action: 'file.download_url.created',
      newData: { caseId: primaryCaseId, documentId: document.id, expiresInSeconds },
      ...metadata,
    });
    return {
      url,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1_000).toISOString(),
    };
  }

  async #parseAndStage(request: Request): Promise<StagedResult[]> {
    let parser: ReturnType<typeof busboy>;
    try {
      parser = busboy({
        headers: request.headers,
        preservePath: true,
        limits: {
          fileSize: this.config.fileIntake.maxFileBytes,
          files: this.config.fileIntake.maxFilesPerRequest,
          fields: 0,
          headerPairs: 100,
        },
      });
    } catch {
      throw this.#invalidMultipart();
    }

    const tasks: Promise<StagedResult>[] = [];
    const abortControllers = new Set<AbortController>();
    let fileIndex = 0;
    let globalError: FileIntakeError | undefined;
    let rejectParsing: (reason?: unknown) => void = () => undefined;
    const onRequestAborted = () => {
      for (const abortController of abortControllers) {
        abortController.abort();
      }
      rejectParsing(this.#invalidMultipart());
    };
    const parsed = new Promise<void>((resolve, reject) => {
      rejectParsing = reject;
      parser.on('file', (fieldName, stream, info) => {
        const currentIndex = fileIndex;
        fileIndex += 1;
        tasks.push(this.#stageResult(fieldName, stream, info, currentIndex, abortControllers));
      });
      parser.on('filesLimit', () => {
        globalError = new FileIntakeError(
          'FILE_COUNT_LIMIT',
          413,
          'FILE_COUNT_LIMIT_EXCEEDED',
          'A quantidade de arquivos excede o limite permitido.',
        );
      });
      parser.on('fieldsLimit', () => {
        globalError = this.#invalidMultipart();
      });
      parser.on('partsLimit', () => {
        globalError = this.#invalidMultipart();
      });
      parser.once('error', reject);
      parser.once('close', resolve);
      request.once('aborted', onRequestAborted);
    });
    request.pipe(parser);

    try {
      await parsed;
    } catch {
      globalError = this.#invalidMultipart();
    }
    const results = await Promise.all(tasks);
    request.off('aborted', onRequestAborted);

    if (globalError !== undefined) {
      await Promise.all(
        results
          .filter((result): result is Extract<StagedResult, { accepted: true }> => result.accepted)
          .map((result) => this.#deleteObjectSafely(result.staged.storageKey)),
      );
      throw globalError;
    }
    return results;
  }

  async #stageResult(
    fieldName: string,
    stream: Readable & { truncated?: boolean },
    info: FileInfo,
    fileIndex: number,
    abortControllers: Set<AbortController>,
  ): Promise<StagedResult> {
    try {
      if (fieldName !== 'files' && fieldName !== 'file') {
        stream.resume();
        throw this.#invalidMultipart();
      }
      return {
        accepted: true,
        staged: await this.#stageFile(stream, info, fileIndex, abortControllers),
      };
    } catch (error: unknown) {
      stream.resume();
      const intakeError =
        error instanceof FileIntakeError
          ? error
          : new FileIntakeError(
              'STORAGE_UNAVAILABLE',
              503,
              'FILE_STORAGE_UNAVAILABLE',
              'Não foi possível armazenar o arquivo.',
            );
      return {
        accepted: false,
        error: intakeError,
        rejection: {
          fileIndex,
          code: intakeError.publicCode,
          message: intakeError.publicMessage,
        },
      };
    }
  }

  async #stageFile(
    stream: Readable & { truncated?: boolean },
    info: FileInfo,
    fileIndex: number,
    abortControllers: Set<AbortController>,
  ): Promise<StagedFile> {
    const filename = sanitizeFilename(info.filename);
    const clientMimeType = info.mimeType.toLowerCase();
    if (!this.#allowedMimeTypes.has(clientMimeType)) {
      throw new FileIntakeError(
        'TYPE_NOT_ALLOWED',
        415,
        'FILE_TYPE_NOT_ALLOWED',
        'O tipo de arquivo informado não é permitido.',
      );
    }

    const storageKey = `quarantine/${randomUUID()}/${randomUUID()}`;
    const inspector = new FileStreamInspector(this.scanner.createSession());
    const abortController = new AbortController();
    abortControllers.add(abortController);
    let exceededLimit = false;
    const onLimit = () => {
      exceededLimit = true;
      abortController.abort();
    };
    stream.once('limit', onLimit);
    stream.pipe(inspector);

    try {
      await this.storage.putPrivateObject({
        bucket: this.config.objectStorage.bucket,
        key: storageKey,
        body: inspector,
        contentType: clientMimeType,
        abortController,
      });
      if (exceededLimit || stream.truncated === true) {
        throw new FileIntakeError(
          'FILE_TOO_LARGE',
          413,
          'FILE_TOO_LARGE',
          'O arquivo excede o limite de tamanho permitido.',
        );
      }
      const inspection = await inspector.result(clientMimeType, filename.extension);
      if (inspection.virusScanStatus === 'INFECTED') {
        throw new FileIntakeError(
          'INFECTED_FILE',
          422,
          'INFECTED_FILE',
          'O arquivo foi rejeitado pela verificação de segurança.',
        );
      }
      return { fileIndex, storageKey, filename, inspection };
    } catch (error: unknown) {
      await this.#deleteObjectSafely(storageKey);
      if (exceededLimit || stream.truncated === true) {
        throw new FileIntakeError(
          'FILE_TOO_LARGE',
          413,
          'FILE_TOO_LARGE',
          'O arquivo excede o limite de tamanho permitido.',
        );
      }
      throw error;
    } finally {
      abortControllers.delete(abortController);
    }
  }

  async #persistStaged(
    actor: ActorContext,
    caseId: string,
    staged: StagedFile,
    metadata: RequestAuditMetadata,
  ): Promise<AcceptedFileIntakeResponseDto> {
    const scannerUnavailable = staged.inspection.virusScanStatus === 'ERROR';
    const resources = await withTransaction(this.database.client, async (transaction) => {
      const created = await this.repository.createIntakeResources(transaction, {
        organizationId: actor.organizationId,
        caseId,
        uploadedById: actor.userId,
        storageProvider: 'MINIO',
        storageBucket: this.config.objectStorage.bucket,
        storageKey: staged.storageKey,
        originalFilename: staged.filename.displayName,
        mimeType: staged.inspection.detectedMimeType,
        extension: staged.filename.extension,
        sizeBytes: staged.inspection.sizeBytes,
        checksumSha256: staged.inspection.checksumSha256,
        virusScanStatus: scannerUnavailable ? 'ERROR' : 'CLEAN',
        fileStatus: scannerUnavailable ? 'QUARANTINED' : 'AVAILABLE',
        documentTitle: staged.filename.title,
        jobType: scannerUnavailable ? 'VIRUS_SCAN' : 'FILE_VALIDATION',
      });
      await this.audit.recordDomainInTransaction(transaction, {
        organizationId: actor.organizationId,
        userId: actor.userId,
        entityId: created.file.id,
        entityType: 'file',
        action: 'file.uploaded',
        newData: {
          caseId,
          documentId: created.document.id,
          processingJobId: created.job.id,
          mimeType: created.file.mimeType,
          sizeBytes: Number(created.file.sizeBytes),
          status: created.file.status,
          virusScanStatus: created.file.virusScanStatus,
          isDuplicate: created.document.isDuplicate,
        },
        ...metadata,
      });
      if (created.file.duplicateOfFileId !== null) {
        await this.audit.recordDomainInTransaction(transaction, {
          organizationId: actor.organizationId,
          userId: actor.userId,
          entityId: created.file.id,
          entityType: 'file',
          action: 'file.duplicate.detected',
          newData: {
            caseId,
            documentId: created.document.id,
            duplicateOfFileId: created.file.duplicateOfFileId,
          },
          ...metadata,
        });
      }
      if (scannerUnavailable) {
        await this.audit.recordDomainInTransaction(transaction, {
          organizationId: actor.organizationId,
          userId: actor.userId,
          entityId: created.file.id,
          entityType: 'file',
          action: 'file.upload.quarantined',
          newData: {
            caseId,
            documentId: created.document.id,
            reason: 'SCANNER_UNAVAILABLE',
          },
          ...metadata,
        });
      }
      return created;
    });
    try {
      await this.processingQueue.publish({
        processingJobId: resources.job.id,
        organizationId: actor.organizationId,
        correlationId: metadata.correlationId ?? metadata.requestId ?? randomUUID(),
        jobType: resources.job.jobType,
      });
    } catch {
      this.#logger.warn('processing_job_enqueue_deferred', {
        job_id: resources.job.id,
        organization_id: actor.organizationId,
      });
    }
    return mapCreatedIntake(resources);
  }

  async #auditRejection(
    actor: ActorContext,
    caseId: string,
    fileIndex: number,
    error: FileIntakeError,
    metadata: RequestAuditMetadata,
  ): Promise<void> {
    await this.audit.recordDomain({
      organizationId: actor.organizationId,
      userId: actor.userId,
      entityId: null,
      entityType: 'file',
      action: 'file.upload.rejected',
      newData: { caseId, fileIndex, reason: error.reason },
      ...metadata,
    });
  }

  async #deleteObjectSafely(storageKey: string): Promise<void> {
    try {
      await this.storage.deleteObject(this.config.objectStorage.bucket, storageKey);
    } catch {
      // A later reconciliation report will surface the orphan without deleting it automatically.
    }
  }

  #invalidMultipart(): FileIntakeError {
    return new FileIntakeError(
      'INVALID_MULTIPART',
      400,
      'INVALID_MULTIPART',
      'Envie os arquivos em uma requisição multipart válida.',
    );
  }

  #notFound(): ApiException {
    return new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Recurso não encontrado.');
  }
}
