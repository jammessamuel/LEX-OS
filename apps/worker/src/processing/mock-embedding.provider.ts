import { Inject, Injectable } from '@nestjs/common';
import type { RuntimeConfig } from '@lex-os/config';
import {
  DeterministicMockEmbeddingProvider as SharedDeterministicMockEmbeddingProvider,
  type EmbeddingProvider,
} from '@lex-os/shared';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';

export const EMBEDDING_PROVIDER = Symbol('EMBEDDING_PROVIDER');

@Injectable()
export class MockEmbeddingProvider
  extends SharedDeterministicMockEmbeddingProvider
  implements EmbeddingProvider
{
  constructor(@Inject(RUNTIME_CONFIG) config: RuntimeConfig) {
    super();
    if (config.environment === 'production') {
      throw new Error('The mock embedding provider cannot run in production.');
    }
  }
}
