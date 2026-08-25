/**
 * Contratos de entrada e saída por tarefa.
 *
 * O schema é o mesmo para toda especialidade — quem varia é o texto da instrução. Fatorado
 * porque o validador do worker é um só por tarefa: se cada área declarasse o próprio schema,
 * uma divergência entre elas não teria sequer onde aparecer.
 */

export const TIMELINE_INPUT = {
  type: 'object',
  additionalProperties: false,
  required: ['sourceTextLength'],
  properties: { sourceTextLength: { type: 'integer', minimum: 1 } },
} as const;

export const TIMELINE_OUTPUT = {
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
} as const;

export const CHECKLIST_INPUT = {
  type: 'object',
  additionalProperties: false,
  required: ['documentTypeCode', 'items'],
  properties: {
    documentTypeCode: { type: ['string', 'null'] },
    items: { type: 'array', minItems: 1 },
  },
} as const;

export const CHECKLIST_OUTPUT = {
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
} as const;

export const GROUNDED_INPUT = {
  type: 'object',
  additionalProperties: false,
  required: ['question', 'sources'],
  properties: {
    question: { type: 'string', minLength: 2, maxLength: 500 },
    sources: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['chunkId', 'content'],
      },
    },
  },
} as const;

export const GROUNDED_OUTPUT = {
  type: 'object',
  additionalProperties: false,
  required: [
    'schemaVersion',
    'provider',
    'modelName',
    'modelVersion',
    'promptVersion',
    'executionId',
    'costAmount',
    'costCurrency',
    'claims',
  ],
  properties: {
    schemaVersion: { const: 1 },
    claims: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'sourceChunkIds'],
        properties: {
          text: { type: 'string', minLength: 1, maxLength: 2000 },
          sourceChunkIds: {
            type: 'array',
            minItems: 1,
            maxItems: 3,
            items: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
  },
} as const;

export const CLASSIFICATION_INPUT = {
  type: 'object',
  additionalProperties: false,
  required: ['availableTypeCodes'],
  properties: {
    availableTypeCodes: { type: 'array', minItems: 1, items: { type: 'string' } },
  },
} as const;

export const CLASSIFICATION_OUTPUT = {
  type: 'object',
  additionalProperties: false,
  required: ['provider', 'modelName', 'code', 'confidence'],
  properties: {
    provider: { type: 'string' },
    modelName: { type: 'string' },
    code: { type: 'string' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
} as const;

export const ENTITIES_INPUT = TIMELINE_INPUT;

export const ENTITIES_OUTPUT = {
  type: 'object',
  additionalProperties: false,
  required: ['provider', 'modelName', 'entities'],
  properties: {
    provider: { type: 'string' },
    modelName: { type: 'string' },
    entities: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'entityType',
          'normalizedValue',
          'originalValue',
          'pageNumber',
          'startOffset',
          'endOffset',
          'confidenceScore',
        ],
      },
    },
  },
} as const;
