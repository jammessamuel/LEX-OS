import { specialtyCodeFor } from '@lex-os/shared';

import { genericPrompts } from './prompts/generico.js';
import { civelPrompts } from './prompts/civel.js';
import { criminalPrompts } from './prompts/criminal.js';
import { previdenciarioPrompts } from './prompts/previdenciario.js';
import { trabalhistaPrompts } from './prompts/trabalhista.js';
import { tributarioPrompts } from './prompts/tributario.js';
import type { PromptSpecification, PromptTask } from './specification.js';

/**
 * Escolhe o prompt de uma tarefa para a área jurídica do caso.
 *
 * A busca é: prompt da especialidade, e na falta dele o genérico. Área não catalogada cai
 * direto no genérico — um escritório de direito marítimo continua funcionando sem que ninguém
 * tenha catalogado direito marítimo.
 */

/** Toda especificação conhecida. Prompts de especialidade entram aqui conforme a pesquisa sai. */
export const promptLibrary: readonly PromptSpecification[] = [
  ...genericPrompts,
  ...trabalhistaPrompts,
  ...civelPrompts,
  ...criminalPrompts,
  ...previdenciarioPrompts,
  ...tributarioPrompts,
];

const bySpecialtyAndTask = new Map<string, PromptSpecification>();
const byTaskGeneric = new Map<PromptTask, PromptSpecification>();

for (const prompt of promptLibrary) {
  if (prompt.specialty === null) {
    byTaskGeneric.set(prompt.task, prompt);
  } else {
    bySpecialtyAndTask.set(`${prompt.specialty} ${prompt.task}`, prompt);
  }
}

export class MissingPromptError extends Error {
  constructor(task: PromptTask) {
    super(`No prompt is registered for task ${task}.`);
    this.name = 'MissingPromptError';
  }
}

export class UnreviewedPromptError extends Error {
  constructor(identifier: string, reason: string) {
    super(
      `Prompt ${identifier} cannot run over a real case archive: ${reason} ` +
        'A named reviewer must attest the current version first.',
    );
    this.name = 'UnreviewedPromptError';
  }
}

/**
 * A atestação cobre este texto?
 *
 * Devolve o motivo da recusa em vez de um booleano: quem lê o erro precisa saber se falta
 * revisão ou se a revisão envelheceu, e as duas coisas se consertam de formas diferentes.
 */
export function reviewGapFor(prompt: PromptSpecification): string | null {
  if (prompt.reviewStatus !== 'REVIEWED' || prompt.review === null) {
    return 'it is still a draft.';
  }
  if (prompt.review.reviewedVersion !== prompt.version) {
    return `the attestation covers version ${prompt.review.reviewedVersion}, not ${prompt.version}.`;
  }
  if (prompt.review.capacity === 'LAWYER' && prompt.review.oab === null) {
    return 'the lawyer attestation carries no bar registration.';
  }
  return null;
}

export interface PromptSelectionOptions {
  /**
   * O que o acervo desta instalação guarda. Recebido por parâmetro para o pacote não ler
   * `process.env` sozinho.
   *
   * Antes disto a guarda olhava para `NODE_ENV === 'production'`, e o nome do ambiente não mede
   * risco: um laptop apontado para a base de um cliente roda como `development` e passava
   * inteiro. Omitir vale como acervo real — a recusa é o caminho seguro.
   */
  caseArchive?: 'fictional' | 'real';
}

/**
 * Rascunho não roda sobre acervo real.
 *
 * Exposta à parte de `promptFor` para o teste conseguir exercitar a recusa com um rascunho
 * sintético. Depender de existir rascunho na biblioteca faria a garantia sumir no dia em que
 * tudo estivesse aprovado — que é justamente quando ela precisa continuar de pé.
 */
export function assertUsableIn(prompt: PromptSpecification, caseArchive: string | undefined): void {
  if (caseArchive === 'fictional') {
    return;
  }
  const gap = reviewGapFor(prompt);
  if (gap !== null) {
    throw new UnreviewedPromptError(prompt.identifier, gap);
  }
}

/**
 * Escolhe e valida o prompt da tarefa.
 *
 * Os prompts saem de pesquisa automatizada e nenhum passou por revisão de advogado. Marcar como
 * `DRAFT` e não impedir nada seria rótulo decorativo; a recusa é o que faz o estado significar
 * alguma coisa. Segue o mesmo padrão fail-closed dos provedores mock — mas a condição é o acervo
 * ser fictício, não o processo se chamar produção.
 */
export function promptFor(
  task: PromptTask,
  legalArea: string | null | undefined,
  options: PromptSelectionOptions = {},
): PromptSpecification {
  const specialty = specialtyCodeFor(legalArea);
  const selected =
    (specialty === null ? undefined : bySpecialtyAndTask.get(`${specialty} ${task}`)) ??
    byTaskGeneric.get(task);

  if (selected === undefined) {
    throw new MissingPromptError(task);
  }
  assertUsableIn(selected, options.caseArchive);
  return selected;
}

/** Versão do prompt que a tarefa usaria, para carimbar procedência sem montar a chamada. */
export function promptVersionFor(
  task: PromptTask,
  legalArea: string | null | undefined,
  options: PromptSelectionOptions = {},
): string {
  return promptFor(task, legalArea, options).version;
}
