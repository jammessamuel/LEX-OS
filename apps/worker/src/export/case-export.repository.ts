import { Injectable } from '@nestjs/common';
import { withTransaction } from '@lex-os/database';

import { DatabaseService } from '../database/database.service.js';
import type { DossierInput } from './case-dossier.js';

/** Teto do trecho citado. Um deslocamento errado não pode despejar a página inteira no PDF. */
const MAX_EXCERPT = 240;

function locator(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function locatorPage(value: unknown): number | null {
  const page = locator(value)?.['pageNumber'];
  return typeof page === 'number' && Number.isInteger(page) && page > 0 ? page : null;
}

/**
 * O trecho de origem, recortado do texto extraído pelo deslocamento registrado.
 *
 * É isto que transforma "a inteligência identificou uma data" em prova conferível: o leitor vê
 * a frase que originou o fato e pode abrir o documento na página indicada. Sem isso o dossiê
 * seria mais uma lista de afirmações pedindo confiança, que é o que o mercado já entrega.
 */
function excerptFrom(rawText: string | null | undefined, value: unknown): string | null {
  const parts = locator(value);
  if (typeof rawText !== 'string' || parts === null) {
    return null;
  }
  const startOffset = parts['startOffset'];
  const endOffset = parts['endOffset'];
  if (typeof startOffset !== 'number' || typeof endOffset !== 'number') {
    return null;
  }
  if (startOffset < 0 || endOffset <= startOffset || startOffset >= rawText.length) {
    return null;
  }
  const slice = rawText.slice(startOffset, Math.min(endOffset, startOffset + MAX_EXCERPT)).trim();
  return slice === '' ? null : slice;
}

export interface ClaimedExport {
  jobId: string;
  organizationId: string;
  caseId: string;
  requestedById: string | null;
}

@Injectable()
export class CaseExportRepository {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Toma o trabalho para si com uma atualização guardada.
   *
   * O `WHERE` repete o estado esperado e a versão: duas entregas do mesmo job — que o BullMQ
   * permite depois de uma reconexão — disputam a mesma linha e só uma vence. A perdedora
   * recebe zero linhas alteradas e desiste, em vez de gerar o mesmo PDF duas vezes.
   */
  async claim(organizationId: string, jobId: string): Promise<ClaimedExport | null> {
    return withTransaction(this.database.client, async (transaction) => {
      const current = await transaction.processingJob.findFirst({
        where: { id: jobId, organizationId, jobType: 'CASE_EXPORT' },
        select: { id: true, caseId: true, status: true, version: true, inputMetadata: true },
      });
      if (current === null || current.caseId === null) {
        return null;
      }
      if (current.status !== 'QUEUED' && current.status !== 'RETRYING') {
        return null;
      }
      const updated = await transaction.processingJob.updateMany({
        where: {
          id: current.id,
          organizationId,
          status: current.status,
          version: current.version,
        },
        data: {
          status: 'PROCESSING',
          attempts: { increment: 1 },
          version: { increment: 1 },
          startedAt: new Date(),
          errorCode: null,
          errorMessage: null,
        },
      });
      if (updated.count !== 1) {
        return null;
      }
      const requestedBy = locator(current.inputMetadata)?.['requestedById'];
      return {
        jobId: current.id,
        organizationId,
        caseId: current.caseId,
        requestedById: typeof requestedBy === 'string' ? requestedBy : null,
      };
    });
  }

  async complete(
    organizationId: string,
    jobId: string,
    caseId: string,
    output: { bucket: string; key: string; byteSize: number },
  ): Promise<void> {
    await withTransaction(this.database.client, async (transaction) => {
      const updated = await transaction.processingJob.updateMany({
        where: { id: jobId, organizationId, status: 'PROCESSING' },
        data: {
          status: 'COMPLETED',
          version: { increment: 1 },
          finishedAt: new Date(),
          outputMetadata: output,
        },
      });
      if (updated.count !== 1) {
        throw new Error('Case export completion lost an optimistic concurrency race.');
      }
      await transaction.auditLog.create({
        data: {
          organizationId,
          userId: null,
          actorType: 'SYSTEM',
          actorId: 'lex-os-worker',
          entityType: 'case',
          entityId: caseId,
          action: 'case.export.generated',
          // Sem título, sem texto do caso, sem URL assinada: o registro diz que houve
          // exportação, de qual caso, e o tamanho. O conteúdo do dossiê é do dossiê.
          newData: { byteSize: output.byteSize },
          requestId: null,
          correlationId: null,
          processingJobId: jobId,
        },
      });
    });
  }

  async fail(
    organizationId: string,
    jobId: string,
    error: { code: string; message: string },
    permanent: boolean,
  ): Promise<void> {
    await this.database.client.processingJob.updateMany({
      where: { id: jobId, organizationId, status: 'PROCESSING' },
      data: {
        status: permanent ? 'FAILED' : 'RETRYING',
        version: { increment: 1 },
        ...(permanent ? { finishedAt: new Date() } : {}),
        errorCode: error.code,
        errorMessage: error.message,
      },
    });
  }

  /**
   * Reúne o dossiê.
   *
   * Tudo é filtrado por `organizationId` mesmo já tendo vindo de um job do escritório: o
   * trabalho de fundo não é lugar para confiar num identificador que veio de fora, e uma
   * consulta sem o recorte aqui seria a mais silenciosa das falhas de isolamento.
   */
  async dossier(organizationId: string, caseId: string): Promise<DossierInput | null> {
    const client = this.database.client;

    const legalCase = await client.case.findFirst({
      where: { id: caseId, organizationId, deletedAt: null },
      select: {
        internalCode: true,
        cnjNumber: true,
        court: true,
        courtDivision: true,
        title: true,
        description: true,
        legalArea: true,
        caseType: true,
        status: true,
        priority: true,
        confidentialityLevel: true,
        openedAt: true,
        responsibleUser: { select: { name: true } },
        organization: { select: { tradeName: true, legalName: true } },
      },
    });
    if (legalCase === null) {
      return null;
    }

    const [participants, events, unconfirmedEventCount, checklists, documentCount] =
      await Promise.all([
        client.caseParticipant.findMany({
          where: { organizationId, caseId, person: { deletedAt: null } },
          orderBy: [{ createdAt: 'asc' }],
          select: {
            role: true,
            side: true,
            isClient: true,
            person: { select: { fullName: true } },
          },
        }),
        client.timelineEvent.findMany({
          // Só o confirmado. Um dossiê que mistura fato verificado com proposta de modelo
          // transfere para o leitor uma checagem que era nossa.
          where: { organizationId, caseId, confirmedByUser: true },
          orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
          select: {
            occurredAt: true,
            datePrecision: true,
            title: true,
            description: true,
            sourceLocator: true,
            confidenceScore: true,
            sourceDocument: { select: { title: true } },
            extraction: {
              select: {
                provider: true,
                modelName: true,
                modelVersion: true,
                rawText: true,
              },
            },
          },
        }),
        client.timelineEvent.count({
          where: { organizationId, caseId, confirmedByUser: false },
        }),
        client.caseChecklist.findMany({
          where: { organizationId, caseId },
          orderBy: [{ createdAt: 'asc' }],
          select: {
            templateVersion: true,
            createdAt: true,
            template: { select: { name: true } },
            items: {
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
              select: {
                titleSnapshot: true,
                status: true,
                isRequiredSnapshot: true,
                notes: true,
                document: { select: { title: true } },
              },
            },
          },
        }),
        client.document.count({ where: { organizationId, caseId, deletedAt: null } }),
      ]);

    return {
      organizationName: legalCase.organization.tradeName,
      generatedAt: new Date().toISOString(),
      generatedBy: '',
      legalCase: {
        internalCode: legalCase.internalCode,
        cnjNumber: legalCase.cnjNumber,
        cnjSegment: null,
        court: legalCase.court,
        courtDivision: legalCase.courtDivision,
        title: legalCase.title,
        description: legalCase.description,
        legalArea: legalCase.legalArea,
        caseType: legalCase.caseType,
        status: legalCase.status,
        priority: legalCase.priority,
        confidentialityLevel: legalCase.confidentialityLevel,
        responsible: legalCase.responsibleUser?.name ?? null,
        openedAt: legalCase.openedAt.toISOString(),
      },
      participants: participants.map((participant) => ({
        name: participant.person.fullName,
        role: participant.role,
        side: participant.side,
        isClient: participant.isClient,
      })),
      events: events.flatMap((event) =>
        event.occurredAt === null
          ? []
          : [
              {
                occurredAt: event.occurredAt.toISOString(),
                precision: event.datePrecision,
                title: event.title,
                description: event.description,
                provenance:
                  event.sourceDocument === null
                    ? null
                    : {
                        documentTitle: event.sourceDocument.title,
                        page: locatorPage(event.sourceLocator),
                        excerpt: excerptFrom(event.extraction?.rawText, event.sourceLocator),
                        provider: event.extraction?.provider ?? null,
                        model: event.extraction?.modelName ?? null,
                        modelVersion: event.extraction?.modelVersion ?? null,
                        confidence:
                          event.confidenceScore === null ? null : Number(event.confidenceScore),
                      },
              },
            ],
      ),
      unconfirmedEventCount,
      checklists: checklists.map((checklist) => ({
        templateName: checklist.template.name,
        templateVersion: checklist.templateVersion,
        appliedAt: checklist.createdAt.toISOString(),
        items: checklist.items.map((item) => ({
          requirement: item.titleSnapshot,
          status: item.status,
          mandatory: item.isRequiredSnapshot,
          documentTitle: item.document?.title ?? null,
          note: item.notes,
        })),
      })),
      documentCount,
    };
  }

  async requesterName(organizationId: string, userId: string | null): Promise<string> {
    if (userId === null) {
      return 'sistema';
    }
    const user = await this.database.client.user.findFirst({
      where: { id: userId, organizationId },
      select: { name: true },
    });
    return user?.name ?? 'sistema';
  }
}
