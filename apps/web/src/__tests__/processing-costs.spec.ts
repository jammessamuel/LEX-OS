import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ProcessingCostsView from '../views/ProcessingCostsView.vue';

const request = vi.hoisted(() => vi.fn());

vi.mock('../api/client.js', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return { ...actual, request };
});

function resumo(overrides: Record<string, unknown> = {}) {
  return {
    from: '2026-08-01T00:00:00.000Z',
    to: '2026-08-28T00:00:00.000Z',
    currency: 'BRL',
    total: '128.500000',
    executions: 42,
    groupBy: 'provider',
    buckets: [
      { key: 'lex-os-mock-ocr', label: null, amount: '100.000000', executions: 30 },
      { key: 'lex-os-mock-timeline', label: null, amount: '28.500000', executions: 12 },
    ],
    ...overrides,
  };
}

describe('ProcessingCostsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    request.mockReset();
  });

  it('responde primeiro o total do escritório, que é o número que faltava', async () => {
    request.mockResolvedValue(resumo());
    const wrapper = mount(ProcessingCostsView);
    await flushPromises();

    // O teto do sistema sempre foi por caso. Um escritório com trezentos casos ativos não tinha
    // teto nenhum de fato: cada caso respeitava o seu e a conta chegava inteira no fim do mês.
    const total = wrapper.get('[role="status"]').text();
    expect(total).toContain('128,50');
    expect(total).toContain('42');
  });

  it('pede o mês corrente por padrão, e o dia final entra inteiro', async () => {
    request.mockResolvedValue(resumo());
    mount(ProcessingCostsView);
    await flushPromises();

    const [rota, opcoes] = request.mock.calls[0] as [
      string,
      { query: { from?: string; to?: string; groupBy?: string } },
    ];
    expect(rota).toBe('/processing-costs');
    expect(opcoes.query.groupBy).toBe('provider');
    if (opcoes.query.from === undefined || opcoes.query.to === undefined) {
      throw new Error('A consulta saiu sem período.');
    }

    // O fim é exclusivo na API. Se o intervalo terminasse no início do dia escolhido, o gasto
    // de hoje ficaria de fora — e a pergunta "quanto gastamos" é quase sempre sobre hoje.
    const de = new Date(opcoes.query.from);
    const ate = new Date(opcoes.query.to);
    expect(de.getDate()).toBe(1);
    expect(ate.getTime()).toBeGreaterThan(Date.now());
  });

  it('troca o recorte pedindo de novo ao servidor, e não reordenando o que já tem', async () => {
    request.mockResolvedValue(resumo());
    const wrapper = mount(ProcessingCostsView);
    await flushPromises();

    const [porCaso] = wrapper.findAll('[role="tab"]').filter((b) => b.text() === 'Caso');
    if (porCaso === undefined) {
      throw new Error('O recorte por caso não apareceu.');
    }
    request.mockResolvedValue(resumo({ groupBy: 'case', buckets: [] }));
    await porCaso.trigger('click');
    await flushPromises();

    const ultima = request.mock.calls.at(-1) as [string, { query: { groupBy?: string } }];
    expect(ultima[1].query.groupBy).toBe('case');
  });

  it('sem execução no período, explica em vez de mostrar zero sem contexto', async () => {
    request.mockResolvedValue(resumo({ total: '0.000000', executions: 0, buckets: [] }));
    const wrapper = mount(ProcessingCostsView);
    await flushPromises();

    expect(wrapper.text()).toContain('Nenhuma execução concluída com custo');
    expect(wrapper.text()).toContain('confira o período');
  });

  it('diz que trabalho reservado não entra, para o número não ser lido como previsão', async () => {
    request.mockResolvedValue(resumo());
    const wrapper = mount(ProcessingCostsView);
    await flushPromises();

    expect(wrapper.text()).toContain('reservado e ainda não concluído não entra');
  });
});
