import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { CasesModule } from '../cases/cases.module.js';
import { RUNTIME_CONFIG, RuntimeConfigModule } from '../config/runtime-config.module.js';
import type { RuntimeConfig } from '@lex-os/config';
import { AnthropicGroundedLanguageModelProvider } from './anthropic-grounded-language-model.provider.js';
import { SearchModule } from '../search/search.module.js';
import { AssistantController } from './assistant.controller.js';
import { AssistantService } from './assistant.service.js';
import { GROUNDED_LANGUAGE_MODEL_PROVIDER } from './grounded-language-model.provider.js';
import { MockGroundedLanguageModelProvider } from './mock-grounded-language-model.provider.js';

@Module({
  imports: [AuditModule, CasesModule, RuntimeConfigModule, SearchModule],
  controllers: [AssistantController],
  providers: [
    AssistantService,
    MockGroundedLanguageModelProvider,
    {
      // Quem escolhe é a configuração, e a escolha acontece uma vez, na partida. Trocar de
      // provedor por chamada deixaria o custo e a procedência dependendo de quem chamou.
      provide: GROUNDED_LANGUAGE_MODEL_PROVIDER,
      inject: [RUNTIME_CONFIG, MockGroundedLanguageModelProvider],
      useFactory: (config: RuntimeConfig, mock: MockGroundedLanguageModelProvider) =>
        config.languageModel.provider === 'anthropic'
          ? new AnthropicGroundedLanguageModelProvider(config)
          : mock,
    },
  ],
})
export class AssistantModule {}
