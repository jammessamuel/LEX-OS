import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { RuntimeConfigModule } from '../config/runtime-config.module.js';
import { SearchModule } from '../search/search.module.js';
import { AssistantController } from './assistant.controller.js';
import { AssistantService } from './assistant.service.js';
import { GROUNDED_LANGUAGE_MODEL_PROVIDER } from './grounded-language-model.provider.js';
import { MockGroundedLanguageModelProvider } from './mock-grounded-language-model.provider.js';

@Module({
  imports: [AuditModule, RuntimeConfigModule, SearchModule],
  controllers: [AssistantController],
  providers: [
    AssistantService,
    {
      provide: GROUNDED_LANGUAGE_MODEL_PROVIDER,
      useClass: MockGroundedLanguageModelProvider,
    },
  ],
})
export class AssistantModule {}
