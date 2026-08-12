import { Inject, Injectable } from '@nestjs/common';
import type { RuntimeConfig } from '@lex-os/config';
import {
  DeterministicMockEmbeddingProvider as SharedDeterministicMockEmbeddingProvider,
  type EmbeddingProvider,
} from '@lex-os/shared';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';

export const SEARCH_EMBEDDING_PROVIDER = Symbol('SEARCH_EMBEDDING_PROVIDER');

@Injectable()
export class MockSearchEmbeddingProvider
  extends SharedDeterministicMockEmbeddingProvider
  implements EmbeddingProvider
{
  constructor(@Inject(RUNTIME_CONFIG) config: RuntimeConfig) {
    super();
    if (config.environment === 'production') {
      throw new Error('The mock search embedding provider cannot run in production.');
    }
  }
}
