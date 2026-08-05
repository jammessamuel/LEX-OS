import { Module } from '@nestjs/common';
import { loadRuntimeConfig, type RuntimeConfig } from '@lex-os/config';

export const RUNTIME_CONFIG = Symbol('RUNTIME_CONFIG');

@Module({
  providers: [
    {
      provide: RUNTIME_CONFIG,
      useFactory: (): RuntimeConfig => loadRuntimeConfig(),
    },
  ],
  exports: [RUNTIME_CONFIG],
})
export class RuntimeConfigModule {}
