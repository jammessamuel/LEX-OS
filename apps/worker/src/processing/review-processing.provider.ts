import { Inject, Injectable } from '@nestjs/common';
import { SOURCE_TEXT_LIMIT, type PromptSpecification } from '@lex-os/ai-prompts';

/**
 * O texto do documento como as tarefas de revisão o recebem, com o aviso de truncamento.
 *
 * Recortar sem avisar faria o modelo concluir sobre um documento que ele viu pela metade.
 */
export interface SourceText {
  content: string;
  totalLength: number;
  truncated: boolean;
}

export function sourceTextFrom(rawText: string): SourceText {
  return {
    content: rawText.slice(0, SOURCE_TEXT_LIMIT),
    totalLength: rawText.length,
    truncated: rawText.length > SOURCE_TEXT_LIMIT,
  };
}

/** A exigência como o checklist a recebe: o enunciado, não só o código de tipo. */
export interface ChecklistRequirement {
  id: string;
  documentTypeCode: string | null;
  title: string;
  description: string | null;
  isRequired: boolean;
}
import type { RuntimeConfig } from '@lex-os/config';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';

export interface SourceLocatorV1 {
  pageNumber: number;
  startOffset: number;
  endOffset: number;
}

/**
 * O que aconteceu com o exame do documento, separado do que ele produziu.
 *
 * Sem isto o contrato exigia pelo menos um evento, e as duas situações honestas não tinham como
 * ser ditas: procuração e comprovante de endereço não carregam fato datado nenhum, e página
 * ilegível não foi examinada. Nos dois casos o modelo era obrigado a devolver um evento — quer
 * dizer, a inventar um. Um sistema que promete procedência não pode ter, no contrato, um caminho
 * cuja única saída é a invenção.
 */
export const timelineOutcomes = ['ANALYZED', 'UNREADABLE'] as const;
export type TimelineOutcome = (typeof timelineOutcomes)[number];

export interface TimelineProviderOutputV1 {
  schemaVersion: 1;
  provider: string;
  modelName: string;
  promptVersion: string;
  /** `UNREADABLE` obriga lista vazia: quem não conseguiu ler não tem o que registrar. */
  outcome: TimelineOutcome;
  events: readonly {
    eventType: string;
    title: string;
    description: string;
    occurredAt: string;
    datePrecision: DatePrecision;
    importance: Importance;
    sourceLocator: SourceLocatorV1;
    confidenceScore: number;
  }[];
}

export const datePrecisions = ['EXACT', 'DAY', 'MONTH', 'YEAR', 'APPROXIMATE', 'UNKNOWN'] as const;
export const importanceLevels = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as const;
// Os cinco estados que a analise automatica pode propor. VALIDATED, NOT_APPLICABLE e RECEIVED
// ficam de fora de proposito: sao juizo de quem revisa, e a analise nunca preenche validatedBy.
export const proposableChecklistStatuses = [
  'MISSING',
  'AWAITING_VALIDATION',
  'ILLEGIBLE',
  'INVALID',
  'EXPIRED',
] as const;

export type DatePrecision = (typeof datePrecisions)[number];
export type Importance = (typeof importanceLevels)[number];
export type ProposableChecklistStatus = (typeof proposableChecklistStatuses)[number];

export interface ChecklistAnalysisOutputV1 {
  schemaVersion: 1;
  provider: string;
  modelName: string;
  promptVersion: string;
  items: readonly {
    templateItemId: string;
    status: ProposableChecklistStatus;
  }[];
}

export interface TimelineProvider {
  generate(input: {
    sourceTextLength: number;
    sourceText: SourceText;
    prompt: PromptSpecification;
  }): TimelineProviderOutputV1;
}

export interface ChecklistAnalysisProvider {
  analyze(input: {
    documentTypeCode: string | null;
    sourceText: SourceText | null;
    /**
     * O dia contra o qual a validade se afere, no formato ISO de data.
     *
     * O modelo não sabe que dia é hoje, e o prompt proíbe supor. Sem este campo o estado
     * VENCIDO era inalcançável por construção: existia no enum e nenhum caminho honesto
     * chegava nele. Quem sabe a data é este processo, no instante da análise.
     */
    referenceDate: string;
    items: readonly ChecklistRequirement[];
    prompt: PromptSpecification;
  }): ChecklistAnalysisOutputV1;
}

export const TIMELINE_PROVIDER = Symbol('TIMELINE_PROVIDER');
export const CHECKLIST_ANALYSIS_PROVIDER = Symbol('CHECKLIST_ANALYSIS_PROVIDER');

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

export function parseTimelineProviderOutputV1(
  value: unknown,
  sourceTextLength: number,
): TimelineProviderOutputV1 {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'schemaVersion',
      'provider',
      'modelName',
      'promptVersion',
      'outcome',
      'events',
    ]) ||
    value.schemaVersion !== 1 ||
    typeof value.provider !== 'string' ||
    value.provider.length === 0 ||
    value.provider.length > 120 ||
    typeof value.modelName !== 'string' ||
    value.modelName.length === 0 ||
    value.modelName.length > 160 ||
    typeof value.promptVersion !== 'string' ||
    value.promptVersion.length === 0 ||
    value.promptVersion.length > 80 ||
    typeof value.outcome !== 'string' ||
    !(timelineOutcomes as readonly string[]).includes(value.outcome) ||
    !Array.isArray(value.events) ||
    // Lista vazia agora é resposta legítima — mas quem diz que não conseguiu ler não pode, na
    // mesma resposta, registrar o que leu. As duas metades têm de contar a mesma história.
    (value.outcome === 'UNREADABLE' && value.events.length > 0)
  ) {
    throw new Error('Invalid timeline provider output.');
  }

  const events = value.events.map((event): TimelineProviderOutputV1['events'][number] => {
    if (
      !isRecord(event) ||
      !hasOnlyKeys(event, [
        'eventType',
        'title',
        'description',
        'occurredAt',
        'datePrecision',
        'importance',
        'sourceLocator',
        'confidenceScore',
      ]) ||
      typeof event.eventType !== 'string' ||
      event.eventType.length === 0 ||
      event.eventType.length > 100 ||
      typeof event.title !== 'string' ||
      event.title.length === 0 ||
      event.title.length > 255 ||
      typeof event.description !== 'string' ||
      event.description.length === 0 ||
      event.description.length > 4000 ||
      typeof event.occurredAt !== 'string' ||
      Number.isNaN(Date.parse(event.occurredAt)) ||
      // O prompt manda respeitar a precisão escrita — "em março de 2024" produz precisão de
      // mês. Aceitar só DAY forçava o modelo a carimbar um dia que o documento não dá, ou a
      // ter o trabalho inteiro descartado. Data precisa inventada, com localizador que abre na
      // página certa, é o erro que nenhuma conferência humana pega.
      typeof event.datePrecision !== 'string' ||
      !(datePrecisions as readonly string[]).includes(event.datePrecision) ||
      typeof event.importance !== 'string' ||
      !(importanceLevels as readonly string[]).includes(event.importance) ||
      typeof event.confidenceScore !== 'number' ||
      event.confidenceScore < 0 ||
      event.confidenceScore > 1 ||
      !isRecord(event.sourceLocator) ||
      !hasOnlyKeys(event.sourceLocator, ['pageNumber', 'startOffset', 'endOffset'])
    ) {
      throw new Error('Invalid timeline event output.');
    }

    const { pageNumber, startOffset, endOffset } = event.sourceLocator;
    if (
      !Number.isInteger(pageNumber) ||
      !Number.isInteger(startOffset) ||
      !Number.isInteger(endOffset) ||
      (pageNumber as number) < 1 ||
      (startOffset as number) < 0 ||
      (endOffset as number) <= (startOffset as number) ||
      (endOffset as number) > sourceTextLength
    ) {
      throw new Error('Timeline source locator is outside the authorized source.');
    }

    return {
      eventType: event.eventType,
      title: event.title,
      description: event.description,
      occurredAt: event.occurredAt,
      // A guarda acima já provou que o valor está no catálogo; o compilador não a acompanha.
      datePrecision: event.datePrecision as DatePrecision,
      importance: event.importance as Importance,
      sourceLocator: {
        pageNumber: pageNumber as number,
        startOffset: startOffset as number,
        endOffset: endOffset as number,
      },
      confidenceScore: event.confidenceScore,
    };
  });

  return {
    schemaVersion: 1,
    provider: value.provider,
    modelName: value.modelName,
    promptVersion: value.promptVersion,
    outcome: value.outcome as TimelineOutcome,
    events,
  };
}

export function parseChecklistAnalysisOutputV1(
  value: unknown,
  expectedItemIds: readonly string[],
): ChecklistAnalysisOutputV1 {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['schemaVersion', 'provider', 'modelName', 'promptVersion', 'items']) ||
    value.schemaVersion !== 1 ||
    typeof value.provider !== 'string' ||
    value.provider.length === 0 ||
    value.provider.length > 120 ||
    typeof value.modelName !== 'string' ||
    value.modelName.length === 0 ||
    value.modelName.length > 160 ||
    typeof value.promptVersion !== 'string' ||
    value.promptVersion.length === 0 ||
    value.promptVersion.length > 80 ||
    !Array.isArray(value.items) ||
    value.items.length !== expectedItemIds.length
  ) {
    throw new Error('Invalid checklist analysis output.');
  }

  const expected = new Set(expectedItemIds);
  const seen = new Set<string>();
  const items = value.items.map((item): ChecklistAnalysisOutputV1['items'][number] => {
    if (
      !isRecord(item) ||
      !hasOnlyKeys(item, ['templateItemId', 'status']) ||
      typeof item.templateItemId !== 'string' ||
      !expected.has(item.templateItemId) ||
      seen.has(item.templateItemId) ||
      typeof item.status !== 'string' ||
      !(proposableChecklistStatuses as readonly string[]).includes(item.status)
    ) {
      throw new Error('Invalid checklist item analysis output.');
    }
    seen.add(item.templateItemId);
    return {
      templateItemId: item.templateItemId,
      status: item.status as ProposableChecklistStatus,
    };
  });

  return {
    schemaVersion: 1,
    provider: value.provider,
    modelName: value.modelName,
    promptVersion: value.promptVersion,
    items,
  };
}

/** Quantos eventos o extrator determinístico devolve, no máximo. */
const MAX_EVENTOS_DETERMINISTICOS = 12;

/**
 * As duas formas em que documento brasileiro imprime data.
 *
 * `dd/mm/aaaa` domina campo de formulário — holerite, TRCT, espelho de ponto. Contrato,
 * procuração e notificação escrevem por extenso, e é a forma que fecha a peça: "São Bernardo do
 * Campo, 03 de fevereiro de 2020." Varrer só a primeira faria o extrator devolver zero evento
 * justamente no contrato, que é onde a cronologia começa.
 */
const DATA_NUMERICA = /\b(\d{2})\/(\d{2})\/(\d{4})\b/gu;

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

// Acento cai com frequência em texto extraído de digitalização — "marco" por "março" —, então a
// varredura aceita as duas grafias em vez de perder a data.
const DATA_POR_EXTENSO = new RegExp(
  String.raw`\b(\d{1,2})\s+de\s+(${MESES.join('|')}|marco)\s+de\s+(\d{4})\b`,
  'giu',
);

/**
 * A frase em volta da data, para o evento dizer de que ele é.
 *
 * Recorta pelo fim de linha antes do trecho e pelo ponto depois: um documento é lido em linhas,
 * e a linha é o que dá sentido ao número. Corta em 120 caracteres porque o título é rótulo, não
 * transcrição.
 */
function frasePerto(texto: string, inicio: number, fim: number): string {
  const abre = Math.max(texto.lastIndexOf('\n', inicio), 0);
  const fecha = texto.indexOf('\n', fim);
  const linha = texto.slice(abre, fecha === -1 ? texto.length : fecha).trim();
  const limpa = linha.replace(/\s+/gu, ' ');
  return limpa.length > 120 ? `${limpa.slice(0, 117)}…` : limpa;
}

/**
 * As datas que o documento realmente imprime, cada uma com o seu lugar no texto.
 *
 * Antes disto o provedor determinístico devolvia SEMPRE o mesmo evento — "Celebração do contrato
 * fictício", em 05/08/2026, com o localizador fixo em 47–57. Duas consequências: a cronologia do
 * caso virava uma parede de linhas idênticas, e o localizador apontava para um pedaço de texto
 * que não era a data, porque as posições vinham de uma fixture antiga. Procedência que aponta
 * para o lugar errado é pior que procedência nenhuma: ela convida a conferir e mente na conferência.
 *
 * Isto não é inteligência e não finge ser: é uma varredura de datas. O tipo do evento diz apenas
 * que a data foi lida do documento, o título é a própria linha em que ela aparece, e o
 * localizador são os deslocamentos reais do trecho. Documento sem data nenhuma devolve lista
 * vazia — o que passou a ser resposta legítima quando a cronologia ganhou desfecho.
 */
function datasNoTexto(conteudo: string): {
  eventType: string;
  title: string;
  description: string;
  occurredAt: string;
  datePrecision: string;
  importance: string;
  sourceLocator: { pageNumber: number; startOffset: number; endOffset: number };
  confidenceScore: number;
}[] {
  const achados = [
    ...conteudo.matchAll(DATA_NUMERICA),
    ...conteudo.matchAll(DATA_POR_EXTENSO),
  ].sort((a, b) => a.index - b.index);

  const vistos = new Set<string>();
  const eventos = [];
  for (const achado of achados) {
    if (eventos.length >= MAX_EVENTOS_DETERMINISTICOS) {
      break;
    }
    const inicio = achado.index;
    const [, primeiro, segundo, ano] = achado;
    if (primeiro === undefined || segundo === undefined || ano === undefined) {
      continue;
    }
    const escrito = segundo.toLowerCase();
    const mesEscrito = MESES.indexOf(escrito === 'marco' ? 'março' : escrito);
    const dia = primeiro.padStart(2, '0');
    const mes = mesEscrito === -1 ? segundo : String(mesEscrito + 1).padStart(2, '0');
    const iso = `${ano}-${mes}-${dia}T00:00:00.000Z`;
    // Data impossível — 31/02 — é erro de leitura, não fato do caso: descarta em vez de
    // deixar o `Date` deslizar para o mês seguinte em silêncio.
    const conferida = new Date(iso);
    if (Number.isNaN(conferida.getTime()) || conferida.getUTCDate() !== Number(dia)) {
      continue;
    }
    const chave = `${iso}#${inicio}`;
    if (vistos.has(chave)) {
      continue;
    }
    vistos.add(chave);
    const fim = inicio + achado[0].length;
    eventos.push({
      eventType: 'DATE_READ_FROM_DOCUMENT',
      title: frasePerto(conteudo, inicio, fim),
      description: 'Data lida do documento por varredura determinística, sem interpretação.',
      occurredAt: iso,
      datePrecision: 'DAY',
      importance: 'NORMAL',
      sourceLocator: { pageNumber: 1, startOffset: inicio, endOffset: fim },
      // O provedor determinístico lê o que está escrito; a confiança é na leitura, e o que ela
      // significa para o caso continua sendo juízo de quem revisa.
      confidenceScore: 1,
    });
  }
  return eventos;
}

@Injectable()
export class MockReviewProcessingProvider implements TimelineProvider, ChecklistAnalysisProvider {
  constructor(@Inject(RUNTIME_CONFIG) config: RuntimeConfig) {
    if (config.environment === 'production') {
      throw new Error('The mock review provider cannot run in production.');
    }
  }

  generate(input: {
    sourceTextLength: number;
    sourceText: SourceText;
    prompt: PromptSpecification;
  }): TimelineProviderOutputV1 {
    return parseTimelineProviderOutputV1(
      {
        schemaVersion: 1,
        provider: 'lex-os-mock-timeline',
        modelName: 'deterministic-v1',
        promptVersion: input.prompt.version,
        outcome: 'ANALYZED',
        events: datasNoTexto(input.sourceText.content),
      },
      input.sourceTextLength,
    );
  }

  analyze(input: {
    documentTypeCode: string | null;
    sourceText: SourceText | null;
    // O mock é determinístico e não julga validade, então não usa a data — mas a recebe, para
    // que a porta seja a mesma dos dois lados e um provedor real não precise de outra.
    referenceDate: string;
    items: readonly ChecklistRequirement[];
    prompt: PromptSpecification;
  }): ChecklistAnalysisOutputV1 {
    return parseChecklistAnalysisOutputV1(
      {
        schemaVersion: 1,
        provider: 'lex-os-mock-checklist',
        modelName: 'deterministic-v1',
        promptVersion: input.prompt.version,
        items: input.items.map((item) => ({
          templateItemId: item.id,
          status:
            item.documentTypeCode !== null && item.documentTypeCode === input.documentTypeCode
              ? 'AWAITING_VALIDATION'
              : 'MISSING',
        })),
      },
      input.items.map((item) => item.id),
    );
  }
}
