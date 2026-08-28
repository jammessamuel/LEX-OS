import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { RuntimeConfig } from '@lex-os/config';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import { DatabaseService } from '../database/database.service.js';

/**
 * "Resumo diário" do ADR-013, em milissegundos. Não é configuração: a cadência é decisão de
 * produto, não botão de operação. Preparo em lote com um e-mail por documento viraria ruído,
 * e aviso que vira ruído deixa de ser lido.
 */
const DIGEST_INTERVAL_MS = 24 * 60 * 60 * 1_000;

/**
 * Até onde a varredura olha para trás quando alguém nunca recebeu resumo, ou quando o worker
 * ficou dias fora do ar. Sem esse piso, uma instalação parada por um mês mandaria um resumo
 * com o mês inteiro — que ninguém lê — e a consulta cresceria sem limite.
 */
const MAX_LOOKBACK_MS = 7 * DIGEST_INTERVAL_MS;

/** Teto da varredura por rodada. O que sobrar fica para a próxima: nada se perde, só atrasa. */
const MAX_COMPLETIONS = 500;

/**
 * Intervalo mínimo entre duas varreduras.
 *
 * O laço do worker bate a cada `reconcileIntervalSeconds`, que pode ser cinco segundos — e a
 * consulta de conclusões filtra por `finishedAt`, que não é indexado. Varrer sete dias a cada
 * cinco segundos custaria caro para produzir silêncio quase sempre. Uma hora é fina o bastante
 * para um aviso diário e barata o bastante para o banco.
 */
const SWEEP_INTERVAL_MS = 60 * 60 * 1_000;

/** Quantos códigos de caso o e-mail lista antes de resumir o resto em contagem. */
const MAX_LISTED_CASES = 10;

const TEMPLATE_ID = 'preparation-digest';

interface DigestBucket {
  organizationId: string;
  userId: string;
  documentIds: Set<string>;
  caseCodes: Set<string>;
}

/**
 * O terceiro gatilho do ADR-013: resumo diário de preparação concluída, para o responsável
 * pelo caso.
 *
 * Os outros dois avisos saem no instante do fato, porque falha e atribuição pedem ação. Este
 * não: um lote de vinte documentos terminando junto renderia vinte e-mails, e a decisão manda
 * agrupar. Por isso ele é varredura periódica, e não gancho no fim da esteira.
 *
 * A marca de água é a própria caixa de saída — o `createdAt` do último resumo enfileirado para
 * cada pessoa. Não há tabela de estado nova: a linha que prova o envio é a mesma que diz até
 * onde já se contou, e reiniciar o worker não reenvia nem pula período.
 *
 * Conteúdo mínimo, como os irmãos: quantos documentos, em quais casos pelo código interno, e um
 * link para o painel. Nunca título de documento, teor extraído nem nome de parte.
 */
@Injectable()
export class PreparationDigestService implements OnModuleInit, OnModuleDestroy {
  readonly #logger = new Logger(PreparationDigestService.name);
  #timer: NodeJS.Timeout | undefined;
  #lastSweptAt: number | undefined;

  constructor(
    private readonly database: DatabaseService,
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.#sweep();
    this.#timer = setInterval(
      () => void this.#sweep().catch((error: unknown) => this.#logFailure(error)),
      this.config.processing.reconcileIntervalSeconds * 1_000,
    );
    this.#timer.unref();
  }

  /**
   * O laço bate junto com o resto do worker; a varredura mesmo é represada pelo relógio.
   *
   * A represa é de memória, não de banco: reiniciar o worker faz varrer de novo na hora, e isso
   * é inofensivo — a marca de água está na caixa de saída, então varrer duas vezes não manda
   * dois e-mails.
   */
  async #sweep(): Promise<void> {
    const now = Date.now();
    if (this.#lastSweptAt !== undefined && now - this.#lastSweptAt < SWEEP_INTERVAL_MS) {
      return;
    }
    this.#lastSweptAt = now;
    await this.digestOnce();
  }

  onModuleDestroy(): void {
    if (this.#timer !== undefined) {
      clearInterval(this.#timer);
    }
  }

  /**
   * Uma rodada. Devolve quantos resumos foram enfileirados, para o teste poder afirmar
   * silêncio — que é o estado correto na maior parte das rodadas.
   */
  async digestOnce(now: Date = new Date()): Promise<number> {
    const dueBefore = new Date(now.getTime() - DIGEST_INTERVAL_MS);
    const floor = new Date(now.getTime() - MAX_LOOKBACK_MS);

    const lastEnqueued = await this.#lastEnqueuedByRecipient();
    const completions = await this.#completionsWithin(floor, now);

    const buckets = new Map<string, DigestBucket>();
    for (const completion of completions) {
      const responsibleId = completion.case?.responsibleUserId ?? null;
      const caseCode = completion.case?.internalCode;
      const documentId = completion.documentId;
      if (responsibleId === null || caseCode === undefined || documentId === null) {
        continue;
      }

      const key = `${completion.organizationId}:${responsibleId}`;
      const previous = lastEnqueued.get(key);
      if (previous !== undefined) {
        // Já recebeu resumo nas últimas vinte e quatro horas: ainda não é a hora dele.
        if (previous > dueBefore) {
          continue;
        }
        // Conta só o que terminou depois do último resumo. Sem isto, o mesmo documento
        // entraria no resumo de amanhã outra vez.
        if (completion.finishedAt !== null && completion.finishedAt <= previous) {
          continue;
        }
      }

      const bucket = buckets.get(key) ?? {
        organizationId: completion.organizationId,
        userId: responsibleId,
        documentIds: new Set<string>(),
        caseCodes: new Set<string>(),
      };
      bucket.documentIds.add(documentId);
      bucket.caseCodes.add(caseCode);
      buckets.set(key, bucket);
    }

    let enqueued = 0;
    for (const bucket of buckets.values()) {
      if (await this.#enqueue(bucket)) {
        enqueued += 1;
      }
    }
    if (enqueued > 0) {
      this.#logger.log('preparation_digest_enqueued', { count: enqueued });
    }
    return enqueued;
  }

  /**
   * Último resumo por pessoa, lido da caixa de saída.
   *
   * Conta a linha enfileirada, e não a entregue: o despachante já registra a falha na própria
   * linha e tem retry, e refazer o mesmo período no dia seguinte mandaria o resumo duas vezes
   * para quem recebeu o primeiro.
   */
  async #lastEnqueuedByRecipient(): Promise<Map<string, Date>> {
    const rows = await this.database.client.emailOutbox.groupBy({
      by: ['organizationId', 'userId'],
      where: { templateId: TEMPLATE_ID },
      _max: { createdAt: true },
    });
    const byRecipient = new Map<string, Date>();
    for (const row of rows) {
      const at = row._max.createdAt;
      if (at !== null) {
        byRecipient.set(`${row.organizationId}:${row.userId}`, at);
      }
    }
    return byRecipient;
  }

  /**
   * As preparações que terminaram na janela.
   *
   * `EMBEDDING` é a última etapa da esteira: concluí-la é o que leva o documento a
   * `NEEDS_REVIEW`, que neste produto é o que "preparação concluída" significa — a máquina
   * terminou, e a confirmação humana continua pendente por decisão e não por atraso.
   */
  #completionsWithin(floor: Date, now: Date) {
    return this.database.client.processingJob.findMany({
      where: {
        jobType: 'EMBEDDING',
        status: 'COMPLETED',
        finishedAt: { gt: floor, lte: now },
        case: { deletedAt: null, responsibleUserId: { not: null } },
      },
      select: {
        organizationId: true,
        documentId: true,
        finishedAt: true,
        case: { select: { internalCode: true, responsibleUserId: true } },
      },
      orderBy: [{ finishedAt: 'asc' }, { id: 'asc' }],
      take: MAX_COMPLETIONS,
    });
  }

  async #enqueue(bucket: DigestBucket): Promise<boolean> {
    try {
      const recipient = await this.database.client.user.findFirst({
        where: { organizationId: bucket.organizationId, id: bucket.userId, status: 'ACTIVE' },
        select: { email: true, name: true, silencedNotifications: true },
      });
      if (recipient === null) {
        return false;
      }
      // Este aviso se desliga, ao contrário da falha de documento, que não consulta preferência
      // nenhuma. A coluna guarda o que foi DESLIGADO, então conta nova nasce recebendo.
      if (recipient.silencedNotifications.includes(TEMPLATE_ID)) {
        return false;
      }

      await this.database.client.emailOutbox.create({
        data: {
          organizationId: bucket.organizationId,
          userId: bucket.userId,
          templateId: TEMPLATE_ID,
          recipient: recipient.email,
          payload: {
            recipientName: recipient.name,
            documentCount: String(bucket.documentIds.size),
            caseCodes: describeCases(bucket.caseCodes),
            link: `${this.config.service.webOrigin}/painel`,
          },
        },
        select: { id: true },
      });
      return true;
    } catch (error) {
      // Mesma regra dos irmãos: falhar ao avisar não derruba a rodada nem o fato avisado. O
      // log leva o gatilho e a organização, nunca o endereço nem o código do caso.
      this.#logger.error({
        event: 'notification_enqueue_failed',
        templateId: TEMPLATE_ID,
        organizationId: bucket.organizationId,
        reason: error instanceof Error ? error.name : 'unknown',
      });
      return false;
    }
  }

  #logFailure(error: unknown): void {
    this.#logger.error('preparation_digest_failed', error);
  }
}

/**
 * Códigos de caso em uma linha, com teto.
 *
 * Um responsável com quarenta casos em movimento receberia quarenta códigos numa frase só, que
 * não se lê. O teto corta a lista e diz quantos ficaram de fora; a contagem exata de documentos
 * continua no campo próprio.
 */
export function describeCases(codes: ReadonlySet<string>): string {
  const ordered = [...codes].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  if (ordered.length <= MAX_LISTED_CASES) {
    return ordered.join(', ');
  }
  const shown = ordered.slice(0, MAX_LISTED_CASES);
  const rest = ordered.length - shown.length;
  return `${shown.join(', ')} e mais ${rest} caso${rest === 1 ? '' : 's'}`;
}
