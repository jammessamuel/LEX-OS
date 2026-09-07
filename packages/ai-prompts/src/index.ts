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
