import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CasesView from '../views/CasesView.vue';

const request = vi.hoisted(() => vi.fn());

vi.mock('../api/client.js', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return { ...actual, request };
});

const { ApiError } = await import('../api/client');

function mountView() {
  return mount(CasesView, {
    global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
  });
}

const demoCase = {
  id: '00000000-0000-4000-8000-000000000003',
  internalCode: 'DEMO-0001',
  title: 'Caso fictício de demonstração',
  description: null,
  legalArea: 'DIREITO_TRABALHISTA',
  caseType: 'RECLAMACAO_TRABALHISTA',
  status: 'UNDER_ANALYSIS' as const,
  priority: 'URGENT' as const,
  confidentialityLevel: 'CONFIDENTIAL' as const,
  responsibleUserId: null,
  openedAt: '2026-08-05T12:00:00.000Z',
  closedAt: null,
  createdAt: '2026-08-05T12:00:00.000Z',
  updatedAt: '2026-08-05T12:00:00.000Z',
};

describe('CasesView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    request.mockReset();
  });

  it('apresenta o caso com vocabulário do usuário, nunca com o código da API', async () => {
    request.mockResolvedValue({
      data: [demoCase],
      pageInfo: { nextCursor: null, hasNextPage: false },
    });

    const wrapper = mountView();
    await flushPromises();
    const text = wrapper.text();

    expect(text).toContain('DEMO-0001');
    expect(text).toContain('Em análise');
    expect(text).toContain('Urgente');
    expect(text).toContain('Confidencial');
    expect(text).not.toContain('UNDER_ANALYSIS');
    expect(text).not.toContain('URGENT');
  });

  it('explica o vazio em vez de mostrar uma tabela sem linhas', async () => {
    request.mockResolvedValue({ data: [], pageInfo: { nextCursor: null, hasNextPage: false } });

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Nenhum caso por aqui ainda');
    expect(wrapper.find('table').exists()).toBe(false);
  });

  it('mostra a falha de forma recuperável e permite tentar de novo', async () => {
    request.mockRejectedValueOnce(
      new ApiError({
        statusCode: 503,
        code: 'SERVICE_UNAVAILABLE',
        message: 'O serviço está temporariamente indisponível.',
        requestId: 'req-1',
      }),
    );

    const wrapper = mountView();
    await flushPromises();

    const alert = wrapper.get('[role="alert"]');
    expect(alert.text()).toContain('O serviço está temporariamente indisponível.');
    expect(alert.text()).toContain('req-1');

    request.mockResolvedValue({
      data: [demoCase],
      pageInfo: { nextCursor: null, hasNextPage: false },
    });
    await wrapper.get('[role="alert"] button').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('DEMO-0001');
  });
});
