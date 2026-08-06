export interface PromptSpecification {
  identifier: string;
  version: string;
  purpose: string;
  inputSchema: Readonly<Record<string, unknown>>;
  outputSchema: Readonly<Record<string, unknown>>;
  examples: readonly Readonly<Record<string, unknown>>[];
  validationCriteria: readonly string[];
}

export const timelinePromptV1 = {
  identifier: 'lex-os.timeline.mock',
  version: 'timeline-mock-v1',
  purpose: 'Produce preliminary timeline events with resolvable document locations.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['sourceTextLength'],
    properties: { sourceTextLength: { type: 'integer', minimum: 1 } },
  },
  outputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['schemaVersion', 'provider', 'modelName', 'promptVersion', 'events'],
    properties: {
      schemaVersion: { const: 1 },
      events: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'eventType',
            'title',
            'description',
            'occurredAt',
            'datePrecision',
            'importance',
            'sourceLocator',
            'confidenceScore',
          ],
        },
      },
    },
  },
  examples: [
    {
      input: { sourceTextLength: 100 },
      output: {
        eventType: 'CONTRACT_DATE',
        occurredAt: '2026-08-05T00:00:00.000Z',
        sourceLocator: { pageNumber: 1, startOffset: 47, endOffset: 57 },
      },
    },
  ],
  validationCriteria: [
    'Reject unknown output fields.',
    'Reject locators outside the authorized source length.',
    'Persist every generated event as unconfirmed.',
    'Require the source document and generation extraction to belong to the same tenant and case.',
  ],
} as const satisfies PromptSpecification;

export const checklistPromptV1 = {
  identifier: 'lex-os.checklist.mock',
  version: 'checklist-mock-v1',
  purpose: 'Propose document-checklist matches without overwriting human review.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['documentTypeCode', 'items'],
    properties: {
      documentTypeCode: { type: ['string', 'null'] },
      items: { type: 'array', minItems: 1 },
    },
  },
  outputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['schemaVersion', 'provider', 'modelName', 'promptVersion', 'items'],
    properties: {
      schemaVersion: { const: 1 },
      items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['templateItemId', 'status'],
          properties: {
            templateItemId: { type: 'string', format: 'uuid' },
            status: { enum: ['MISSING', 'AWAITING_VALIDATION'] },
          },
        },
      },
    },
  },
  examples: [
    {
      input: { documentTypeCode: 'OUTRO', itemDocumentTypeCode: 'OUTRO' },
      output: { status: 'AWAITING_VALIDATION' },
    },
  ],
  validationCriteria: [
    'Return every selected template item exactly once.',
    'Reject unknown template item identifiers and statuses.',
    'Link proposed documents only within the same tenant and case.',
    'Never replace a human-reviewed checklist status with an AI proposal.',
  ],
} as const satisfies PromptSpecification;
