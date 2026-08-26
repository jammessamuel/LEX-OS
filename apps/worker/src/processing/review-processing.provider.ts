import { Inject, Injectable } from '@nestjs/common';
import type { PromptSpecification } from '@lex-os/ai-prompts';
import type { RuntimeConfig } from '@lex-os/config';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';

export interface SourceLocatorV1 {
  pageNumber: number;
  startOffset: number;
  endOffset: number;
}

export interface TimelineProviderOutputV1 {
  schemaVersion: 1;
  provider: string;
  modelName: string;
  promptVersion: string;
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
    prompt: PromptSpecification;
  }): TimelineProviderOutputV1;
}

export interface ChecklistAnalysisProvider {
  analyze(input: {
    documentTypeCode: string | null;
    items: readonly { id: string; documentTypeCode: string | null }[];
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
    !hasOnlyKeys(value, ['schemaVersion', 'provider', 'modelName', 'promptVersion', 'events']) ||
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
    !Array.isArray(value.events) ||
    value.events.length === 0
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

@Injectable()
export class MockReviewProcessingProvider implements TimelineProvider, ChecklistAnalysisProvider {
  constructor(@Inject(RUNTIME_CONFIG) config: RuntimeConfig) {
    if (config.environment === 'production') {
      throw new Error('The mock review provider cannot run in production.');
    }
  }

  generate(input: {
    sourceTextLength: number;
    prompt: PromptSpecification;
  }): TimelineProviderOutputV1 {
    return parseTimelineProviderOutputV1(
      {
        schemaVersion: 1,
        provider: 'lex-os-mock-timeline',
        modelName: 'deterministic-v1',
        promptVersion: input.prompt.version,
        events: [
          {
            eventType: 'CONTRACT_DATE',
            title: 'Celebração do contrato fictício',
            description: 'Data contratual identificada no documento fictício processado.',
            occurredAt: '2026-08-05T00:00:00.000Z',
            datePrecision: 'DAY',
            importance: 'NORMAL',
            sourceLocator: { pageNumber: 1, startOffset: 47, endOffset: 57 },
            confidenceScore: 0.98,
          },
        ],
      },
      input.sourceTextLength,
    );
  }

  analyze(input: {
    documentTypeCode: string | null;
    items: readonly { id: string; documentTypeCode: string | null }[];
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
