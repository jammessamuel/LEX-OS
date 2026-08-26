import { Inject, Injectable } from '@nestjs/common';
import type { RuntimeConfig } from '@lex-os/config';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import type { SourceText } from './review-processing.provider.js';

/**
 * O que a classificação recebe.
 *
 * O catálogo sozinho não classifica nada: até 2026-08-26 esta chamada não recebia argumento
 * algum, e o prompt mandava distinguir minuta de contrato assinado sobre um documento que o
 * provedor nunca via. O mock continua devolvendo OUTRO — quem precisa da entrada é o provedor
 * real, e o contrato tem de existir antes dele.
 */
export interface ClassificationInput {
  availableTypeCodes: readonly string[];
  sourceText: SourceText;
}

export interface MockTextResult {
  provider: string;
  modelName: string;
  rawText: string;
  confidence: number;
}

export interface ProcessingProvider {
  extractText(mimeType: string): MockTextResult;
  classify(input: ClassificationInput): {
    provider: string;
    modelName: string;
    code: 'OUTRO';
    confidence: number;
  };
  extractEntities(input: { sourceText: SourceText }): {
    provider: string;
    modelName: string;
    entities: readonly {
      entityType: string;
      normalizedValue: string;
      originalValue: string;
      pageNumber: number;
      startOffset: number;
      endOffset: number;
      confidenceScore: number;
    }[];
  };
}

export const PROCESSING_PROVIDER = Symbol('PROCESSING_PROVIDER');

@Injectable()
export class MockProcessingProvider implements ProcessingProvider {
  constructor(@Inject(RUNTIME_CONFIG) config: RuntimeConfig) {
    if (config.environment === 'production') {
      throw new Error('The mock processing provider cannot run in production.');
    }
  }

  extractText(mimeType: string): MockTextResult {
    return {
      provider: mimeType.startsWith('text/') ? 'lex-os-mock-text' : 'lex-os-mock-ocr',
      modelName: 'deterministic-v1',
      rawText:
        'Contrato fictício LEX-2026-0001, celebrado em 05/08/2026. Conteúdo exclusivo para desenvolvimento.',
      confidence: mimeType.startsWith('text/') ? 1 : 0.97,
    };
  }

  classify(): {
    provider: string;
    modelName: string;
    code: 'OUTRO';
    confidence: number;
  } {
    return {
      provider: 'lex-os-mock-classifier',
      modelName: 'deterministic-v1',
      code: 'OUTRO',
      confidence: 0.51,
    };
  }

  extractEntities(): {
    provider: string;
    modelName: string;
    entities: readonly {
      entityType: string;
      normalizedValue: string;
      originalValue: string;
      pageNumber: number;
      startOffset: number;
      endOffset: number;
      confidenceScore: number;
    }[];
  } {
    return {
      provider: 'lex-os-mock-entities',
      modelName: 'deterministic-v1',
      entities: [
        {
          entityType: 'CONTRACT_NUMBER',
          normalizedValue: 'LEX-2026-0001',
          originalValue: 'LEX-2026-0001',
          pageNumber: 1,
          startOffset: 19,
          endOffset: 32,
          confidenceScore: 0.99,
        },
        {
          entityType: 'DATE',
          normalizedValue: '2026-08-05',
          originalValue: '05/08/2026',
          pageNumber: 1,
          startOffset: 47,
          endOffset: 57,
          confidenceScore: 0.98,
        },
      ],
    };
  }
}
