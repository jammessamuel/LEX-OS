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

/**
 * Palavras-chave que o schema estruturado da API rejeita com 400 na requisição.
 *
 * A lista vem da documentação de structured outputs (setembro/2026): teto e piso numéricos,
 * limites de comprimento e regex não são expressáveis na gramática. Removê-las NÃO afrouxa
 * nada — os tetos de afirmações, citações e caracteres continuam cobrados pelo parser do
 * serviço e escritos na prosa acima. `format` sai pela razão oposta: a gramática o imporia
 * de verdade, e um identificador de trecho que um dia não fosse UUID ficaria inexprimível
 * pelo modelo; a lista fechada de identificadores é conferida pelo parser, onde falha vira
 * recusa e não impossibilidade.
 */
const CHAVES_QUE_A_API_REJEITA = new Set([
  'maxItems',
  'maxLength',
  'minLength',
  'pattern',
  'minimum',
  'maximum',
  'multipleOf',
  'format',
]);

function podado(schema: unknown): unknown {
  if (Array.isArray(schema)) {
    return schema.map(podado);
  }
  if (schema === null || typeof schema !== 'object') {
    return schema;
  }
  const resultado: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(schema)) {
    if (CHAVES_QUE_A_API_REJEITA.has(chave)) continue;
    // `minItems` só é aceito em 0 ou 1; acima disso a requisição inteira leva 400.
    if (chave === 'minItems' && typeof valor === 'number' && valor > 1) continue;
    resultado[chave] = podado(valor);
  }
  return resultado;
}

/**
 * O schema enviado à API para restringir a geração — derivado do contrato, nunca uma segunda cópia.
 *
 * `GROUNDED_OUTPUT` já viaja em todo prompt como `outputSchema`; escrever o schema do fio à mão
 * seria a segunda cópia da mesma forma, que é exatamente como o teto de cinco afirmações
 * divergiu em 2026-09-07. Daqui sai só a subárvore `claims` — os outros oito campos do contrato
 * são procedência que o adaptador constrói, e um schema que os exigisse seria insatisfazível.
 *
 * O objeto é estável entre requisições de um mesmo build (nada do caso entra), o que importa:
 * a API compila o schema numa gramática com cache de 24 horas chaveado pela estrutura. A lista
 * de identificadores autorizados fica de fora de propósito — como enum ela mudaria o schema a
 * cada pergunta e pagaria a compilação toda vez.
 */
export function groundedWireSchema(prompt: PromptSpecification): Record<string, unknown> {
  const contrato = prompt.outputSchema as { properties?: { claims?: unknown } } | undefined;
  const claims = contrato?.properties?.claims;
  if (claims === undefined) {
    // Erro de programação, não de execução: todo prompt de resposta fundamentada carrega o
    // contrato. Falhar alto aqui é o que impede um prompt malformado de sair sem restrição.
    throw new Error(
      `The prompt ${prompt.version} has no claims contract to derive the wire schema from.`,
    );
  }
  return {
    type: 'object',
    additionalProperties: false,
    required: ['claims'],
    properties: { claims: podado(claims) },
  };
}

/**
 * SHA-256 hexadecimal da instrução efetiva, sem pergunta nem conteúdo dos documentos.
 *
 * Cobre o `system` E o schema estruturado enviado em `output_config.format`: desde 2026-09-08 o
 * schema restringe a geração tanto quanto o texto, e uma impressão digital que o ignorasse
 * deixaria uma mudança de contrato invisível na procedência. `JSON.stringify` simples, sem
 * canonicalizador: o corpo da requisição serializa o mesmo objeto do mesmo jeito, então os
 * bytes hasheados são os bytes enviados.
 */
export function groundedSystemPromptHash(
  prompt: PromptSpecification,
  sources: readonly GroundedPromptSource[],
): string {
  return createHash('sha256')
    .update(
      `${groundedSystemPrompt(prompt, sources)}\n\n${JSON.stringify(groundedWireSchema(prompt))}`,
      'utf8',
    )
    .digest('hex');
}
