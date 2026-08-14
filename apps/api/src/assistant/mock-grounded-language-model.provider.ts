import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { groundedAnswerPromptV1 } from '@lex-os/ai-prompts';
import type { RuntimeConfig } from '@lex-os/config';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import type {
  GroundedLanguageModelProvider,
  GroundedLanguageModelSource,
} from './grounded-language-model.provider.js';

function claimFor(source: GroundedLanguageModelSource) {
  const normalized = source.content.replace(/\s+/gu, ' ').trim().slice(0, 1500);
  return {
    text: `A fonte autorizada informa: ${normalized}`,
    sourceChunkIds: [source.chunkId],
  };
}

@Injectable()
export class MockGroundedLanguageModelProvider implements GroundedLanguageModelProvider {
  constructor(@Inject(RUNTIME_CONFIG) config: RuntimeConfig) {
    if (config.environment === 'production') {
      throw new Error('The mock grounded language model cannot run in production.');
    }
  }

  async generate(input: {
    question: string;
    sources: readonly GroundedLanguageModelSource[];
  }): Promise<unknown> {
    // A pergunta e as fontes são campos separados. O texto recuperado é somente dado hostil:
    // nunca é concatenado às instruções nem interpretado como autorização para ferramentas.
    return Promise.resolve({
      schemaVersion: 1,
      provider: 'lex-os-mock-language-model',
      modelName: 'deterministic-grounded-v1',
      modelVersion: '1',
      promptVersion: groundedAnswerPromptV1.version,
      executionId: randomUUID(),
      costAmount: '0.000000',
      costCurrency: 'BRL',
      claims: input.sources.slice(0, 3).map(claimFor),
    });
  }
}
