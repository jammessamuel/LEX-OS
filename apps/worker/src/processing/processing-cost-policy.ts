import { Inject, Injectable } from '@nestjs/common';
import type { RuntimeConfig } from '@lex-os/config';
import type { ProcessingJobType } from '@lex-os/contracts';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';

export interface ProviderCostQuote {
  provider: string;
  modelName: string;
  modelVersion: string;
  maximumAmount: string;
  currency: 'BRL';
}

export interface MeasuredProviderCost {
  amount: string;
  currency: 'BRL';
}

export interface ProcessingCostPolicy {
  quote(jobType: ProcessingJobType): ProviderCostQuote;
  measureSuccess(
    jobType: ProcessingJobType,
    provider: string,
    modelName: string,
  ): MeasuredProviderCost;
  measureFailure(jobType: ProcessingJobType, error: unknown): MeasuredProviderCost;
}

export const PROCESSING_COST_POLICY = Symbol('PROCESSING_COST_POLICY');

const descriptors: Record<ProcessingJobType, { provider: string; modelName: string }> = {
  FILE_VALIDATION: { provider: 'lex-os-validator', modelName: 'deterministic-v1' },
  VIRUS_SCAN: { provider: 'lex-os-scanner-unavailable', modelName: 'deterministic-v1' },
  OCR: { provider: 'lex-os-mock-ocr', modelName: 'deterministic-v1' },
  DOCUMENT_CLASSIFICATION: {
    provider: 'lex-os-mock-classifier',
    modelName: 'deterministic-v1',
  },
  ENTITY_EXTRACTION: { provider: 'lex-os-mock-entities', modelName: 'deterministic-v1' },
  TIMELINE_GENERATION: { provider: 'lex-os-mock-timeline', modelName: 'deterministic-v1' },
  CHECKLIST_ANALYSIS: { provider: 'lex-os-mock-checklist', modelName: 'deterministic-v1' },
  EMBEDDING: { provider: 'lex-os-mock-embedding', modelName: 'deterministic-hash-v1' },
};

@Injectable()
export class MockProcessingCostPolicy implements ProcessingCostPolicy {
  constructor(@Inject(RUNTIME_CONFIG) config: RuntimeConfig) {
    if (config.environment === 'production') {
      throw new Error('The zero-cost mock processing policy cannot run in production.');
    }
  }

  quote(jobType: ProcessingJobType): ProviderCostQuote {
    return {
      ...descriptors[jobType],
      modelVersion: '1',
      maximumAmount: '0.000000',
      currency: 'BRL',
    };
  }

  measureSuccess(): MeasuredProviderCost {
    return { amount: '0.000000', currency: 'BRL' };
  }

  measureFailure(): MeasuredProviderCost {
    return { amount: '0.000000', currency: 'BRL' };
  }
}
