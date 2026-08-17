import { describe, expect, it } from 'vitest';

import { highlightExcerpt } from '../domain/highlight.js';

const marked = (excerpt: string, query: string) =>
  highlightExcerpt(excerpt, query)
    .filter((segment) => segment.match)
    .map((segment) => segment.text);

describe('highlightExcerpt', () => {
  it('preserva o trecho inteiro na concatenação dos segmentos', () => {
    const excerpt = 'A rescisão contratual ocorreu em 14/03/2019, conforme a cláusula décima.';
    const rebuilt = highlightExcerpt(excerpt, 'rescisão cláusula')
      .map((segment) => segment.text)
      .join('');

    expect(rebuilt).toBe(excerpt);
  });

  it('casa sem acento e sem caixa, e o índice não desloca por causa do acento', () => {
    // "rescisao" sem acento tem de acender "rescisão" — e o segmento seguinte não pode
    // sair cortado, que é o sintoma clássico de índice desalinhado.
    const segments = highlightExcerpt('A RESCISÃO contratual foi comunicada.', 'rescisao');

    expect(segments.filter((segment) => segment.match).map((segment) => segment.text)).toEqual([
      'RESCISÃO',
    ]);
    expect(segments.map((segment) => segment.text).join('')).toBe(
      'A RESCISÃO contratual foi comunicada.',
    );
  });

  it('estende o realce até o fim da palavra, para o radical acender a flexão', () => {
    expect(marked('Foram juntados os contratos e o contrato social.', 'contrat')).toEqual([
      'contratos',
      'contrato',
    ]);
  });

  it('só acende em início de palavra', () => {
    // "ato" não pode acender dentro de "contrato": seria realce que engana a leitura.
    expect(marked('O contrato prevê o ato de rescisão.', 'ato')).toEqual(['ato']);
  });

  it('ignora termos de até duas letras, que pintariam o trecho inteiro', () => {
    expect(marked('A parte de um contrato de trabalho.', 'de um')).toEqual([]);
  });

  it('funde termos sobrepostos em vez de gerar segmentos aninhados', () => {
    const segments = highlightExcerpt('Contrato de trabalho assinado.', 'contrato contratos');

    expect(segments.filter((segment) => segment.match)).toHaveLength(1);
    expect(segments.at(0)?.text).toBe('Contrato');
  });

  it('devolve o trecho sem realce quando nada casa', () => {
    expect(highlightExcerpt('Petição inicial protocolada.', 'honorários')).toEqual([
      { text: 'Petição inicial protocolada.', match: false },
    ]);
  });

  it('trata como texto o que parece marcação dentro do documento', () => {
    // Prova de que o realce é por segmento e não por HTML: o conteúdo do documento é
    // evidência não confiável e nunca vira marcação na tela.
    const excerpt = 'A cláusula <script>alert(1)</script> foi transcrita do original.';

    expect(
      highlightExcerpt(excerpt, 'cláusula')
        .map((segment) => segment.text)
        .join(''),
    ).toBe(excerpt);
  });
});
