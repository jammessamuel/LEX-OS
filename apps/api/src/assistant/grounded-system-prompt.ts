import { createHash } from 'node:crypto';

import {
  MAX_AFIRMACOES_POR_RESPOSTA,
  MAX_CITACOES_POR_AFIRMACAO,
  type PromptSpecification,
} from '@lex-os/ai-prompts';

interface GroundedPromptSource {
  chunkId: string;
}

function outputContract(sources: readonly GroundedPromptSource[]): string {
  return [
    'Responda somente com um objeto JSON, sem cercas de código e sem texto ao redor:',
    '{"claims":[{"text":"...","sourceChunkIds":["..."]}]}',
    '',
    `A lista tem no máximo ${MAX_AFIRMACOES_POR_RESPOSTA} afirmações. Precisando de mais para`,
    'cobrir a pergunta, reúna fatos próximos numa afirmação só em vez de exceder o limite —',
    'passar do teto invalida a resposta inteira e o escritório não recebe nada.',
    '',
    `Cada afirmação cita de um a ${MAX_CITACOES_POR_AFIRMACAO} identificadores, e cada`,
    'identificador precisa ser um dos seguintes, exatamente como escritos:',
    `${sources.map((source) => source.chunkId).join(', ')}.`,
    'Identificador que não estiver nessa lista invalida a resposta inteira.',
    'Sem sustentação nos trechos, devolva {"claims":[]}.',
  ].join('\n');
}

/**
 * Monta exatamente a instrução enviada no campo `system` ao provedor real.
 *
 * A renderização fica fora do adaptador para que a chamada e sua procedência não possam divergir:
 * o mesmo texto que segue para o modelo é o texto cuja impressão digital entra na auditoria.
 */
export function groundedSystemPrompt(
  prompt: PromptSpecification,
  sources: readonly GroundedPromptSource[],
): string {
  return `${prompt.template}\n\n${outputContract(sources)}`;
}

/** SHA-256 hexadecimal da instrução efetiva, sem pergunta nem conteúdo dos documentos. */
export function groundedSystemPromptHash(
  prompt: PromptSpecification,
  sources: readonly GroundedPromptSource[],
): string {
  return createHash('sha256').update(groundedSystemPrompt(prompt, sources), 'utf8').digest('hex');
}
