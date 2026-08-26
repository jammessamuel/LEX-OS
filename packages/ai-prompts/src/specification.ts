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
 * revisão humana. Não é rótulo decorativo: `promptFor` recusa devolver rascunho sobre acervo
 * real, do mesmo modo que os provedores mock recusam subir em produção.
 */
export type PromptReviewStatus = 'DRAFT' | 'REVIEWED';

/**
 * Em que qualidade a pessoa respondeu pelo texto.
 *
 * A distinção existe porque as duas origens são diferentes e ficariam indistinguíveis: os cinco
 * prompts genéricos foram aprovados pelo dono para descrever o comportamento do mock, e os de
 * especialidade precisam de quem responda pelo conteúdo jurídico. Sem registrar a qualidade,
 * ninguém sabe qual é qual no dia em que alguém precisar responder por uma delas.
 */
export type ReviewerCapacity = 'LAWYER' | 'OWNER';

/**
 * A atestação de revisão.
 *
 * Antes disto `REVIEWED` era um literal de união: não dizia quem revisou, com qual inscrição,
 * em que data, nem contra qual versão do texto — e qualquer pessoa promovia qualquer prompt
 * trocando uma palavra.
 *
 * O campo que mais trabalha é `reviewedVersion`. A revisão vale para o texto que foi lido, não
 * para o próximo: alterar o prompt sobe a versão, a atestação deixa de casar, e o prompt volta
 * sozinho a precisar de revisão. É o que impede uma assinatura de 2026 cobrir um texto reescrito
 * em 2027.
 */
export interface PromptReview {
  capacity: ReviewerCapacity;
  /** Nome de quem assina, como consta na inscrição. */
  name: string;
  /**
   * Inscrição na Ordem com a seccional, quando houver.
   *
   * `null` é permitido e não é lacuna a preencher de qualquer jeito: o dono aprovando
   * comportamento de mock não tem inscrição, e advogado em situação de incompatibilidade —
   * art. 28 da Lei 8.906/94, que alcança atividade policial — está licenciado e não pode
   * exercer. Nos dois casos `standing` diz o que se passa, e o registro não finge inscrição
   * ativa que não existe.
   */
  oab: string | null;
  /** A situação da inscrição em uma frase, quando `oab` for `null` ou não estiver ativa. */
  standing: string | null;
  /** Data da revisão, no formato ISO de data. */
  date: string;
  /** A versão do prompt que foi lida. Revisão não alcança versão posterior. */
  reviewedVersion: string;
  /** O que a revisão cobriu, e o que ela deliberadamente não cobriu. */
  note: string;
}

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
  /** A atestação. `null` enquanto o prompt for rascunho. */
  review: PromptReview | null;
  inputSchema: Readonly<Record<string, unknown>>;
  outputSchema: Readonly<Record<string, unknown>>;
  examples: readonly Readonly<Record<string, unknown>>[];
  validationCriteria: readonly string[];
}
