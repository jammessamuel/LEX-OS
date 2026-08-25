import { describe, expect, it } from 'vitest';

import * as shared from '@lex-os/shared/legal-vocabulary';
import {
  caseStatusLabels,
  checklistItemStatusLabels,
  confidentialityLabels,
  participantRoleLabels,
  participantSideLabels,
  priorityLabels,
} from '../domain/vocabulary.js';

/**
 * A tela e o dossiê exportado descrevem o mesmo caso.
 *
 * O PDF é montado pelo worker, que não enxerga o vocabulário da interface, então as palavras
 * vivem em `@lex-os/shared/legal-vocabulary` e a interface mantém as suas com os tipos do
 * contrato da API. Duas cópias divergem em silêncio — e a divergência aparece na pior hora,
 * com o cliente comparando o PDF que recebeu com a tela que o advogado mostra.
 *
 * Este teste não deixa. Se alguém renomear "Não recebido" de um lado só, ele reprova.
 */
describe('vocabulário da interface e do dossiê', () => {
  const pares = [
    ['situação do caso', caseStatusLabels, shared.caseStatusLabels],
    ['prioridade', priorityLabels, shared.priorityLabels],
    ['sigilo', confidentialityLabels, shared.confidentialityLabels],
    ['papel da parte', participantRoleLabels, shared.participantRoleLabels],
    ['polo da parte', participantSideLabels, shared.participantSideLabels],
    ['item de checklist', checklistItemStatusLabels, shared.checklistItemStatusLabels],
  ] as const;

  for (const [nome, daTela, doDossie] of pares) {
    it(`diz a mesma coisa sobre ${nome} na tela e no PDF`, () => {
      expect(doDossie).toEqual({ ...daTela });
    });
  }
});
