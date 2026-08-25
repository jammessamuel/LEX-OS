/**
 * O que é um prompt neste produto.
 *
 * Até aqui o pacote guardava metadados sobre prompts que nunca foram escritos: identificador,
 * versão, schemas e critérios, sem o texto que iria ao modelo. O único campo que o código de
 * produção lia era `version`, para carimbar procedência. `template` é o que faltava.
 *
 * `specialty` e `task` existem porque a mesma tarefa pede instruções diferentes conforme a área.
 * Perguntar "que fatos importam na cronologia" tem resposta distinta numa reclamação trabalhista
 * e numa ação penal, e um prompt único para as duas é um prompt medíocre para ambas.
 */

/** As tarefas que hoje têm porta de provedor. Uma tarefa nova aqui exige uma porta lá. */
export const promptTasks = [
  'TIMELINE',
  'CHECKLIST',
  'GROUNDED_ANSWER',
  'CLASSIFICATION',
  'ENTITIES',
] as const;

export type PromptTask = (typeof promptTasks)[number];

/**
 * `DRAFT` é o estado de quem foi escrito por pesquisa automatizada e ainda não passou por
 * revisão humana. Não é rótulo decorativo: `promptFor` recusa devolver rascunho em produção,
 * do mesmo modo que os provedores mock recusam subir lá.
 */
export type PromptReviewStatus = 'DRAFT' | 'REVIEWED';

export interface PromptSpecification {
  identifier: string;
  version: string;
  purpose: string;
  /** `null` quando o prompt é o genérico, usado por qualquer área sem prompt próprio. */
  specialty: string | null;
  task: PromptTask;
  /** O texto que vai ao modelo. Conteúdo recuperado nunca entra aqui — entra como dado. */
  template: string;
  reviewStatus: PromptReviewStatus;
  inputSchema: Readonly<Record<string, unknown>>;
  outputSchema: Readonly<Record<string, unknown>>;
  examples: readonly Readonly<Record<string, unknown>>[];
  validationCriteria: readonly string[];
}
