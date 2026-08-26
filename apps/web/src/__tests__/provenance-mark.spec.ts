import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import ProvenanceMark from '../components/ProvenanceMark.vue';

/**
 * O defeito que originou estes testes: a nota de procedência era absoluta e os painéis que a
 * hospedam usam `overflow: hidden` para arredondar os cantos, então ela saía cortada na borda
 * do cartão — visível na tela de documento, com a última linha da origem desaparecida.
 *
 * jsdom não faz layout, então o retângulo de cada elemento é encenado aqui.
 */
function montar(marcador: Partial<DOMRect>, nota: Partial<DOMRect> = {}) {
  const wrapper = mount(ProvenanceMark, {
    props: {
      value: 'LEX-2026-0001',
      index: 2,
      sourceLines: ['Holerite-marco-ficticio.txt · página 1', 'caracteres 10-20'],
    },
    attachTo: document.body,
  });

  const gatilho = wrapper.get('button').element;
  const alvo = wrapper.get('[role="tooltip"]').element;
  gatilho.getBoundingClientRect = () => ({ top: 0, bottom: 0, left: 0, ...marcador }) as DOMRect;
  alvo.getBoundingClientRect = () => ({ width: 320, height: 90, ...nota }) as DOMRect;

  return wrapper;
}

function posicao(wrapper: ReturnType<typeof montar>) {
  const estilo = wrapper.get('[role="tooltip"]').attributes('style') ?? '';
  const ler = (campo: string) =>
    Number(new RegExp(`${campo}:\\s*(-?[\\d.]+)px`, 'u').exec(estilo)?.[1]);
  return { top: ler('top'), left: ler('left') };
}

describe('ProvenanceMark', () => {
  it('posiciona a nota em coordenadas de viewport, que overflow de painel não recorta', async () => {
    const wrapper = montar({ top: 200, bottom: 220, left: 140 });
    await wrapper.get('button').trigger('mouseenter');

    // `fixed` é o que faz a nota escapar do `overflow: hidden` do cartão. Trocar por
    // `absolute` traz o corte de volta, e nenhuma tela consegue consertar isso sozinha.
    expect(wrapper.get('[role="tooltip"]').classes()).toContain('prov__src--open');
    expect(posicao(wrapper)).toEqual({ top: 228, left: 140 });
  });

  it('vira para cima quando não cabe embaixo, em vez de sair pelo rodapé', async () => {
    // Janela de 768 no jsdom: marcador a 700 não deixa 90px de nota caberem abaixo.
    const wrapper = montar({ top: 700, bottom: 720, left: 140 });
    await wrapper.get('button').trigger('focus');

    expect(posicao(wrapper).top).toBe(700 - 90 - 8);
  });

  it('não deixa a nota vazar pela direita da janela', async () => {
    // Janela de 1024: uma nota de 320px ancorada em 900 vazaria 208px.
    const wrapper = montar({ top: 100, bottom: 120, left: 900 });
    await wrapper.get('button').trigger('mouseenter');

    expect(posicao(wrapper).left).toBe(1024 - 320 - 12);
  });

  it('esconde a nota ao sair, para ela não ficar presa sobre a tela', async () => {
    const wrapper = montar({ top: 100, bottom: 120, left: 140 });
    await wrapper.get('button').trigger('mouseenter');
    expect(wrapper.get('[role="tooltip"]').classes()).toContain('prov__src--open');

    await wrapper.get('button').trigger('mouseleave');
    expect(wrapper.get('[role="tooltip"]').classes()).not.toContain('prov__src--open');
  });

  it('mantém a nota ligada ao gatilho para quem navega por teclado', () => {
    const wrapper = montar({ top: 100, bottom: 120, left: 140 });
    const descrito = wrapper.get('button').attributes('aria-describedby');

    expect(descrito).toBeTruthy();
    expect(wrapper.get('[role="tooltip"]').attributes('id')).toBe(descrito);
  });
});
