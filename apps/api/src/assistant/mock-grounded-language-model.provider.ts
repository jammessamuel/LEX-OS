import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { PromptSpecification } from '@lex-os/ai-prompts';
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
    prompt: PromptSpecification;
    question: string;
    sources: readonly GroundedLanguageModelSource[];
  }): Promise<unknown> {
    // O provedor real falha de vez em quando sem devolver o objeto JSON pedido, e essa falha
    // escapava como 500 até 2026-09-07. O mock precisa saber falhar para o teste conseguir
    // exercitar o tratamento sem provedor pago — do mesmo jeito que aprendeu a recusar.
    if (input.question.toLowerCase().includes('provedor falha')) {
      throw new Error('The model did not return the requested JSON object.');
    }

    // Terceiro desfecho: o provedor responde e a resposta viola o contrato. Ele não falha e não
    // recusa — devolve uma afirmação sem citação, que é a violação mais comum e a que o produto
    // menos pode deixar passar. Até 2026-09-07 isso virava um 502 mudo, sem dizer qual regra
    // caiu; o mock precisa produzi-lo para o teste conseguir conferir que agora a trilha diz.
    if (input.question.toLowerCase().includes('fora do contrato')) {
      return Promise.resolve({
        schemaVersion: 1,
        provider: 'lex-os-mock-language-model',
        modelName: 'deterministic-grounded-v1',
        modelVersion: '1',
        promptVersion: input.prompt.version,
        executionId: randomUUID(),
        costAmount: '0.000000',
        costCurrency: 'BRL',
        claims: [{ text: 'Afirmação sem nenhuma citação.', sourceChunkIds: [] }],
      });
    }

    // A pergunta e as fontes são campos separados. O texto recuperado é somente dado hostil:
    // nunca é concatenado às instruções nem interpretado como autorização para ferramentas.
    return Promise.resolve({
      schemaVersion: 1,
      provider: 'lex-os-mock-language-model',
      modelName: 'deterministic-grounded-v1',
      modelVersion: '1',
      promptVersion: input.prompt.version,
      executionId: randomUUID(),
      costAmount: '0.000000',
      costCurrency: 'BRL',
      // A pergunta que declara não ter resposta nos trechos devolve lista vazia — é o caminho
      // que o contrato sempre mandou usar e que o parser recusava, obrigando o modelo real a
      // embrulhar a recusa numa afirmação. O mock precisa saber percorrê-lo para o teste
      // conseguir exercitá-lo sem provedor pago.
      claims: input.question.toLowerCase().includes('sem sustentação')
        ? []
        : input.sources.slice(0, 3).map(claimFor),
    });
  }
}
