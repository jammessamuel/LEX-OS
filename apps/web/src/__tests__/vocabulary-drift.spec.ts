import { describe, expect, it } from 'vitest';

import * as shared from '@lex-os/shared/legal-vocabulary';
import {
  caseStatusLabels,
  checklistItemStatusLabels,
  confidentialityLabels,
  participantRoleLabels,
  participantSideLabels,
  priorityLabels,
  providerLabel,
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

  it('chama cada etapa pelo que ela faz, e não esconde o que é simulado', () => {
    // A tela de custo listava "Lex-os-mock-entities" ao escritório e a procedência de um evento
    // dizia "lex-os-mock-timeline" ao advogado que ia confirmá-lo. O mapa vive no pacote
    // compartilhado porque a mesma palavra sai na tela e no PDF; aqui se garante o que ele não
    // pode perder: nenhum identificador interno vaza, e a etapa simulada continua dizendo que é.
    for (const [codigo, rotulo] of Object.entries(shared.providerLabels)) {
      expect(rotulo).not.toMatch(/lex-os|mock/iu);
      if (codigo.includes('mock')) {
        expect(rotulo).toMatch(/simulad|determinístic/iu);
      }
    }
    expect(providerLabel('lex-os-mock-timeline')).toBe('Cronologia (determinística)');
    // Provedor que ninguém cadastrou não pode quebrar a tela, e também não pode sumir: o código
    // cru aparecendo é o sinal de que o mapa ficou para trás.
    expect(providerLabel('provedor-novo-sem-rotulo')).toBe('Provedor novo sem rotulo');
    expect(providerLabel('provedor-novo-sem-rotulo')).not.toContain('-');
  });
});
