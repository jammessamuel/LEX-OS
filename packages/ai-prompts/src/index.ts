export type {
  PromptReview,
  PromptReviewStatus,
  PromptSpecification,
  PromptTask,
  ReviewerCapacity,
} from './specification.js';
export { promptTasks } from './specification.js';

export {
  checklistPromptV1,
  classificationPromptV1,
  entitiesPromptV1,
  genericPrompts,
  groundedAnswerPromptV1,
  timelinePromptV1,
} from './prompts/generico.js';

export {
  checklistTrabalhistaV1,
  classificationTrabalhistaV1,
  entitiesTrabalhistaV1,
  groundedAnswerTrabalhistaV1,
  timelineTrabalhistaV1,
  trabalhistaPrompts,
} from './prompts/trabalhista.js';

// O limite de texto por chamada e decisao de contrato, nao detalhe do pacote: o worker
// recorta por ele e o provedor real vai depender do mesmo numero.
export { SOURCE_TEXT_LIMIT } from './prompts/contratos.js';

import { GROUNDED_OUTPUT } from './prompts/contratos.js';

/**
 * Quantas afirmações uma resposta fundamentada comporta.
 *
 * Sai daqui, e não de um número escrito à mão no validador da API, porque foi assim que ele
 * divergiu: o parser recusava mais de cinco, o contrato não declarava teto nenhum, e o prompt
 * mandava quebrar a afirmação — três lugares dizendo coisas diferentes sobre o mesmo limite.
 * Exportar o valor do contrato faz o validador e o texto seguirem o mesmo número por construção.
 */
export const MAX_AFIRMACOES_POR_RESPOSTA: number = GROUNDED_OUTPUT.properties.claims.maxItems;

/** Quantos trechos uma única afirmação pode citar. Mesma razão: um número, um lugar. */
export const MAX_CITACOES_POR_AFIRMACAO: number =
  GROUNDED_OUTPUT.properties.claims.items.properties.sourceChunkIds.maxItems;

export { administrativoPrompts } from './prompts/administrativo.js';
export { agrarioPrompts } from './prompts/agrario.js';
export { ambientalPrompts } from './prompts/ambiental.js';
export { civelPrompts } from './prompts/civel.js';
export { consumidorPrompts } from './prompts/consumidor.js';
export { criminalPrompts } from './prompts/criminal.js';
export { empresarialPrompts } from './prompts/empresarial.js';
export { familiaPrompts } from './prompts/familia.js';
export { propriedadeIntelectualPrompts } from './prompts/propriedade-intelectual.js';
export { eleitoralPrompts } from './prompts/eleitoral.js';
export { previdenciarioPrompts } from './prompts/previdenciario.js';
export { tributarioPrompts } from './prompts/tributario.js';

export {
  assertUsableIn,
  MissingPromptError,
  promptFor,
  promptLibrary,
  promptVersionFor,
  reviewGapFor,
  UnreviewedPromptError,
} from './select.js';
export type { PromptSelectionOptions } from './select.js';
