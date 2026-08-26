/**
 * Contratos de entrada e saída por tarefa.
 *
 * O schema é o mesmo para toda especialidade — quem varia é o texto da instrução. Fatorado
 * porque o validador do worker é um só por tarefa: se cada área declarasse o próprio schema,
 * uma divergência entre elas não teria sequer onde aparecer.
 */

/**
 * Quanto texto de documento cabe numa chamada.
 *
 * Existe para ser uma decisão escrita, e não uma descoberta no dia em que um PDF de duzentas
 * páginas estourar a janela de um provedor real. Truncar é pior do que não truncar, então o
 * contrato obriga a dizer que truncou: o prompt sabe que viu um pedaço e responde por ele.
 */
export const SOURCE_TEXT_LIMIT = 20_000;

/**
 * O texto do documento como a tarefa o recebe.
 *
 * Antes de 2026-08-26 a cronologia recebia apenas o comprimento do texto e o checklist apenas
 * códigos de tipo. As duas instruções mandavam ler o documento; nenhuma das duas entradas
 * carregava o documento. O mock determinístico não sentia falta porque não lê nada — o defeito
 * só apareceria no primeiro provedor real, respondendo sobre um texto que nunca viu.
 */
export const SOURCE_TEXT = {
  type: 'object',
  additionalProperties: false,
  required: ['content', 'totalLength', 'truncated'],
  properties: {
    content: { type: 'string' },
    totalLength: { type: 'integer', minimum: 0 },
    truncated: { type: 'boolean' },
  },
} as const;

export const TIMELINE_INPUT = {
  type: 'object',
  additionalProperties: false,
  required: ['sourceTextLength', 'sourceText'],
  properties: {
    sourceTextLength: { type: 'integer', minimum: 1 },
    sourceText: SOURCE_TEXT,
  },
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
  required: ['documentTypeCode', 'sourceText', 'items'],
  properties: {
    documentTypeCode: { type: ['string', 'null'] },
    sourceText: { oneOf: [SOURCE_TEXT, { type: 'null' }] },
    items: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        // O enunciado da exigência é o que faltava: sem ele o modelo não tem como saber que o
        // item pede "matrícula atualizada", e o julgamento vira comparação de duas strings —
        // exatamente o que o mock determinístico já fazia sem modelo nenhum.
        required: ['id', 'documentTypeCode', 'title', 'description', 'isRequired'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          documentTypeCode: { type: ['string', 'null'] },
          title: { type: 'string', minLength: 1 },
          description: { type: ['string', 'null'] },
          isRequired: { type: 'boolean' },
        },
      },
    },
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
          status: { enum: ['MISSING', 'AWAITING_VALIDATION', 'ILLEGIBLE', 'INVALID', 'EXPIRED'] },
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
            maxItems: 5,
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
  required: ['availableTypeCodes', 'sourceText'],
  properties: {
    availableTypeCodes: { type: 'array', minItems: 1, items: { type: 'string' } },
    sourceText: SOURCE_TEXT,
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

export const ENTITIES_INPUT = {
  type: 'object',
  additionalProperties: false,
  required: ['sourceText'],
  properties: { sourceText: SOURCE_TEXT },
} as const;

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
