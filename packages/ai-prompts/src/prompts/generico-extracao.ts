import type { PromptSpecification } from '../specification.js';
import { SOURCE_IS_DATA } from './separacao.js';

/**
 * Classificação e extração de entidades.
 *
 * Estas duas etapas rodam no pipeline desde a Entrega 7, mas nunca tiveram prompt — e é por
 * isso que a procedência delas vinha gravada como `deterministic-prompt-v1`, uma versão que não
 * correspondia a prompt nenhum. Com texto de verdade, o carimbo passa a apontar para algo.
 */

export const classificationPromptV1 = {
  identifier: 'lex-os.classification.mock',
  version: 'classification-mock-v1',
  purpose: 'Classify one case document into a known document type with a calibrated confidence.',
  specialty: null,
  task: 'CLASSIFICATION',
  template: `Você classifica um documento de processo judicial brasileiro dentro de um catálogo
fechado de tipos documentais.

${SOURCE_IS_DATA}

Escolha somente entre os códigos de tipo que vierem na entrada. Não invente código, não devolva
mais de um, não devolva variação de grafia.

Quando o documento não corresponder claramente a nenhum tipo do catálogo, classifique como
OUTRO com confiança baixa. Forçar um tipo plausível é pior do que admitir que não deu: o tipo
errado leva o checklist a marcar exigência satisfeita que não foi.

A confiança é o quanto o documento exibe as marcas do tipo escolhido — cabeçalho, estrutura,
vocabulário — e não o quanto o palpite parece razoável.

Responda somente com o JSON do contrato de saída, sem texto ao redor.`,
  reviewStatus: 'REVIEWED',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['availableTypeCodes'],
    properties: {
      availableTypeCodes: { type: 'array', minItems: 1, items: { type: 'string' } },
    },
  },
  outputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['provider', 'modelName', 'code', 'confidence'],
    properties: {
      provider: { type: 'string' },
      modelName: { type: 'string' },
      code: { type: 'string' },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
    },
  },
  examples: [
    {
      input: { availableTypeCodes: ['CONTRATO', 'PROCURACAO', 'OUTRO'] },
      output: { code: 'OUTRO', confidence: 0.51 },
    },
  ],
  validationCriteria: [
    'Reject any type code outside the catalogue sent in the input.',
    'Reject confidence outside the closed interval from zero to one.',
    'Never let a classification overwrite a human-reviewed document type.',
  ],
} as const satisfies PromptSpecification;

export const entitiesPromptV1 = {
  identifier: 'lex-os.entities.mock',
  version: 'entities-mock-v1',
  purpose: 'Extract located entities from case documents, each resolvable back to its source.',
  specialty: null,
  task: 'ENTITIES',
  template: `Você extrai entidades de um documento de processo judicial brasileiro: pessoas,
empresas, documentos de identificação, valores, datas e números de processo.

${SOURCE_IS_DATA}

Extraia apenas o que está escrito. Não normalize o que não puder conferir, não complete CPF ou
CNPJ truncado, não corrija nome que pareça grafado errado — o documento é a prova, e a sua
leitura precisa poder ser conferida contra ele.

Toda entidade traz a página e o intervalo de caracteres onde foi lida, além do texto original
exatamente como aparece. Sem localizador a entidade é descartada: dado extraído que não se
resolve de volta à fonte não vale nada numa discussão.

Quando o mesmo dado aparecer mais de uma vez, extraia cada ocorrência com seu próprio
localizador. Repetição é informação — diz onde o documento afirma a mesma coisa.

Responda somente com o JSON do contrato de saída, sem texto ao redor.`,
  reviewStatus: 'REVIEWED',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['sourceTextLength'],
    properties: { sourceTextLength: { type: 'integer', minimum: 1 } },
  },
  outputSchema: {
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
  },
  examples: [
    {
      input: { sourceTextLength: 100 },
      output: {
        entityType: 'CONTRACT_NUMBER',
        originalValue: 'LEX-2026-0001',
        pageNumber: 1,
        startOffset: 19,
        endOffset: 32,
        confidenceScore: 0.98,
      },
    },
  ],
  validationCriteria: [
    'Reject entities without a resolvable page and character range.',
    'Reject locators outside the authorized source length.',
    'Every extracted entity starts unconfirmed and requires human confirmation.',
    'Never write a complete identification document number to logs or audit records.',
  ],
} as const satisfies PromptSpecification;
