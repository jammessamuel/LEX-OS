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
  cnjNumber: '0001234-27.2026.5.02.0001',
  cnjSegment: 'Justiça do Trabalho',
  court: 'TRT da 2ª Região',
  courtDivision: '1ª Vara do Trabalho de São Paulo',
  title: 'Caso fictício de demonstração',
  description: null,
  legalArea: 'DIREITO_TRABALHISTA',
  caseType: 'RECLAMACAO_TRABALHISTA',
  status: 'UNDER_ANALYSIS' as const,
  priority: 'URGENT' as const,
  confidentialityLevel: 'CONFIDENTIAL' as const,
  responsibleUserId: null,
  responsible: null,
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

  it('mostra o número do processo na frente e o código interno abaixo', async () => {
    request.mockResolvedValue({
      data: [demoCase],
      pageInfo: { nextCursor: null, hasNextPage: false },
    });

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('0001234-27.2026.5.02.0001');
    expect(wrapper.text()).toContain('DEMO-0001');
  });

  it('avisa quando o caso ainda não foi protocolado, em vez de deixar a coluna vazia', async () => {
    request.mockResolvedValue({
      data: [{ ...demoCase, cnjNumber: null, cnjSegment: null }],
      pageInfo: { nextCursor: null, hasNextPage: false },
    });

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Sem número de processo');
    expect(wrapper.text()).toContain('DEMO-0001');
  });

  it('busca pelo número colado sem pontuação, porque é assim que ele chega do e-mail', async () => {
    request.mockResolvedValue({
      data: [demoCase],
      pageInfo: { nextCursor: null, hasNextPage: false },
    });

    const wrapper = mountView();
    await flushPromises();
    request.mockClear();

    await wrapper.get('#case-search-input').setValue('00012342720265020001');
    await wrapper.get('form[role="search"]').trigger('submit');
    await flushPromises();

    expect(request).toHaveBeenCalledWith('/cases', {
      query: { limit: 25, search: '00012342720265020001' },
    });
  });

  it('mantém a busca na segunda página, em vez de trazer a lista inteira de volta', async () => {
    request.mockResolvedValue({
      data: [demoCase],
      pageInfo: { nextCursor: 'cursor-2', hasNextPage: true },
    });

    const wrapper = mountView();
    await flushPromises();

    await wrapper.get('#case-search-input').setValue('DEMO');
    await wrapper.get('form[role="search"]').trigger('submit');
    await flushPromises();
    request.mockClear();

    await wrapper.get('.panel__more button').trigger('click');
    await flushPromises();

    expect(request).toHaveBeenCalledWith('/cases', {
      query: { limit: 25, search: 'DEMO', cursor: 'cursor-2' },
    });
  });

  it('distingue "nada encontrado" de "nenhum caso ainda"', async () => {
    request.mockResolvedValue({ data: [], pageInfo: { nextCursor: null, hasNextPage: false } });

    const wrapper = mountView();
    await flushPromises();

    await wrapper.get('#case-search-input').setValue('0009999-99.2026.5.02.0001');
    await wrapper.get('form[role="search"]').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Nenhum caso encontrado');
    expect(wrapper.text()).not.toContain('Nenhum caso por aqui ainda');
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

describe('responsável na lista', () => {
  it('mostra o nome do responsável, nunca o identificador', async () => {
    request.mockResolvedValue({
      data: [
        {
          ...demoCase,
          responsibleUserId: 'user-1',
          responsible: { id: 'user-1', name: 'Dra. Ana Responsável' },
        },
      ],
      pageInfo: { nextCursor: null, hasNextPage: false },
    });

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Dra. Ana Responsável');
    expect(wrapper.text()).not.toContain('user-1');
  });

  it('diz que não há responsável em vez de deixar a célula vazia', async () => {
    request.mockResolvedValue({
      data: [{ ...demoCase, responsibleUserId: null, responsible: null }],
      pageInfo: { nextCursor: null, hasNextPage: false },
    });

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Sem responsável');
  });
});
