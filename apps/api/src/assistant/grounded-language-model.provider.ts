export interface GroundedLanguageModelSource {
  chunkId: string;
  content: string;
}

export interface GroundedLanguageModelProvider {
  generate(input: {
    question: string;
    sources: readonly GroundedLanguageModelSource[];
  }): Promise<unknown>;
}

export const GROUNDED_LANGUAGE_MODEL_PROVIDER = Symbol('GROUNDED_LANGUAGE_MODEL_PROVIDER');
