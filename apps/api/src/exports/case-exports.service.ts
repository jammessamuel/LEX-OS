import { randomUUID } from 'node:crypto';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { RuntimeConfig } from '@lex-os/config';
import { caseDossierObjectKey } from '@lex-os/shared';

import { AuditService, type RequestAuditMetadata } from '../audit/audit.service.js';
import type { ActorContext } from '../auth/actor-context.js';
import { CasesService } from '../cases/cases.service.js';
import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import { DatabaseService } from '../database/database.service.js';
import { ApiException } from '../http/api-exception.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../storage/object-storage.js';
import { CaseExportPublisher } from './case-export.publisher.js';
import type { CaseExportResponseDto } from './dto/case-export-response.dto.js';

const jobSelect = {
  id: true,
  caseId: true,
  status: true,
  attempts: true,
  outputMetadata: true,
  errorCode: true,
  createdAt: true,
  finishedAt: true,
} as const;

interface JobRow {
  id: string;
  caseId: string | null;
  status: string;
  attempts: number;
  outputMetadata: unknown;
  errorCode: string | null;
  createdAt: Date;
  finishedAt: Date | null;
}

function byteSizeOf(value: unknown): number | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const byteSize = (value as Record<string, unknown>)['byteSize'];
  return typeof byteSize === 'number' ? byteSize : null;
}

@Injectable()
export class CaseExportsService {
  constructor(
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly database: DatabaseService,
    private readonly cases: CasesService,
    private readonly publisher: CaseExportPublisher,
    private readonly audit: AuditService,
  ) {}

  /**
   * Pede o dossiê.
   *
   * A rota não monta nada: persiste o trabalho, publica e devolve. Montar um PDF de um caso
   * grande dentro do processo que atende requisição é o tipo de coisa que funciona no caso
   * de teste e derruba a API no caso real.
   */
  async request(
    actor: ActorContext,
    caseId: string,
    metadata: RequestAuditMetadata,
  ): Promise<CaseExportResponseDto> {
    await this.cases.assertAccessibleForFileResources(actor, caseId, metadata, 'EXPORT');

    // Uma exportação por caso de cada vez: o botão fica visível e é natural clicar duas vezes
    // enquanto nada acontece na tela, e sem esta trava cada clique vira um PDF idêntico.
    //
    // Mas só vale enquanto o pedido estiver mesmo andando. Se o
    // worker morreu no meio, a linha fica PROCESSING para sempre e sem este recorte a pessoa
    // nunca mais conseguiria exportar aquele caso — um travamento permanente por uma queda
    // momentânea.
    const freshSince = new Date(Date.now() - this.config.processing.staleAfterSeconds * 1_000);
    const pending = await this.database.client.processingJob.findFirst({
      where: {
        organizationId: actor.organizationId,
        caseId,
        jobType: 'CASE_EXPORT',
        status: { in: ['QUEUED', 'PROCESSING', 'RETRYING'] },
        updatedAt: { gte: freshSince },
      },
      orderBy: { createdAt: 'desc' },
      select: jobSelect,
    });
    if (pending !== null) {
      return this.#map(pending, caseId);
    }

    const jobId = randomUUID();
    const created = await this.database.client.processingJob.create({
      data: {
        id: jobId,
        organizationId: actor.organizationId,
        caseId,
        jobType: 'CASE_EXPORT',
        status: 'QUEUED',
        // Quem pediu vira a assinatura do documento. É identificador, não conteúdo.
        inputMetadata: { requestedById: actor.userId },
      },
      select: jobSelect,
    });

    await this.audit.recordDomain({
      organizationId: actor.organizationId,
      userId: actor.userId,
      entityId: caseId,
      entityType: 'case',
      action: 'case.export.requested',
      newData: { jobId },
      ...metadata,
    });

    await this.publisher.publish({
      processingJobId: jobId,
      organizationId: actor.organizationId,
      correlationId: metadata.correlationId ?? jobId,
    });

    return this.#map(created, caseId);
  }

  async get(
    actor: ActorContext,
    jobId: string,
    metadata: RequestAuditMetadata,
  ): Promise<CaseExportResponseDto> {
    const job = await this.database.client.processingJob.findFirst({
      where: { id: jobId, organizationId: actor.organizationId, jobType: 'CASE_EXPORT' },
      select: jobSelect,
    });
    if (job === null || job.caseId === null) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Recurso não encontrado.');
    }
    // A permissão é reconferida a cada consulta: quem perdeu o acesso ao caso entre o pedido
    // e o download não pode continuar baixando porque segurou o identificador do trabalho.
    await this.cases.assertAccessibleForFileResources(actor, job.caseId, metadata, 'EXPORT');
    return this.#map(job, job.caseId, actor, metadata);
  }

  async #map(
    job: JobRow,
    caseId: string,
    actor?: ActorContext,
    metadata?: RequestAuditMetadata,
  ): Promise<CaseExportResponseDto> {
    const byteSize = byteSizeOf(job.outputMetadata);
    const base: CaseExportResponseDto = {
      id: job.id,
      caseId,
      status: job.status,
      attempts: job.attempts,
      downloadUrl: null,
      downloadExpiresAt: null,
      byteSize,
      errorCode: job.errorCode,
      createdAt: job.createdAt.toISOString(),
      finishedAt: job.finishedAt?.toISOString() ?? null,
    };
    if (job.status !== 'COMPLETED' || actor === undefined) {
      return base;
    }

    const expiresInSeconds = this.config.objectStorage.downloadUrlTtlSeconds;
    const url = await this.storage.createDownloadUrl({
      bucket: this.config.objectStorage.bucket,
      // A chave é derivada, não guardada: o mesmo cálculo que o worker usou para escrever.
      key: caseDossierObjectKey(actor.organizationId, caseId, job.id),
      filename: `dossie-${caseId}.pdf`,
      contentType: 'application/pdf',
      expiresInSeconds,
    });
    if (metadata !== undefined) {
      await this.audit.recordDomain({
        organizationId: actor.organizationId,
        userId: actor.userId,
        entityId: caseId,
        entityType: 'case',
        action: 'case.export.downloaded',
        // A URL assinada nunca entra aqui: ela é a credencial.
        newData: { jobId: job.id, expiresInSeconds },
        ...metadata,
      });
    }
    return {
      ...base,
      downloadUrl: url,
      downloadExpiresAt: new Date(Date.now() + expiresInSeconds * 1_000).toISOString(),
    };
  }
}
