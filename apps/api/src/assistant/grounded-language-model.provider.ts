import type { PromptSpecification } from '@lex-os/ai-prompts';

export interface GroundedLanguageModelSource {
  chunkId: string;
  content: string;
}

export interface GroundedLanguageModelProvider {
  generate(input: {
    /**
     * O prompt escolhido para a especialidade do caso.
     *
     * Quem escolhe é o serviço, que conhece a área jurídica; o adaptador não sai procurando.
     * Assim a versão gravada na procedência é a do prompt que realmente governou a chamada,
     * e não uma constante importada dentro do adaptador.
     */
    prompt: PromptSpecification;
    question: string;
    sources: readonly GroundedLanguageModelSource[];
  }): Promise<unknown>;
}

export const GROUNDED_LANGUAGE_MODEL_PROVIDER = Symbol('GROUNDED_LANGUAGE_MODEL_PROVIDER');
