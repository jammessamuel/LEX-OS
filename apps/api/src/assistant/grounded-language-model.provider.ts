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

/**
 * Quantos tokens uma resposta pode gastar, no máximo — um número, um lugar.
 *
 * Até 2026-09-08 eram duas cópias de 4096: `MAX_OUTPUT_TOKENS` no adaptador (o teto enviado ao
 * fornecedor) e `TETO_TOKENS_DE_SAIDA` no serviço (a reserva exigida do orçamento do caso antes
 * de chamar). Duas cópias do mesmo número em dois arquivos é exatamente como o teto de cinco
 * afirmações divergiu em 2026-09-07. A porta é a casa certa: os dois lados dependem dela, e
 * nenhum é dono do outro.
 *
 * O valor subiu de 4096 para 8192 porque no modelo atual o teto cobre também os tokens de
 * pensamento — ligados por padrão — com um tokenizador mais verboso, e a pergunta de transcrição
 * de 2026-09 mediu respostas de ~1.960 tokens só de saída visível. Subir o teto não muda o gasto
 * típico (paga-se o que for gerado); muda a reserva exigida, e errar para mais aqui recusa uma
 * pergunta a mais num caso já encostado no orçamento, que é a direção segura.
 *
 * Histórico: 2048 derrubou o demo em 2026-09-03 — a resposta cresceu, o JSON cortou no meio do
 * teto e o parse quebrou; 4096 foi a primeira correção.
 */
export const TETO_TOKENS_DE_SAIDA = 8192;
