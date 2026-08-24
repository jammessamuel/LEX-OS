import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CaseFormView from '../views/CaseFormView.vue';
import { useSessionStore } from '../stores/session.js';

const mocks = vi.hoisted(() => ({
  params: {} as { id?: string },
  replace: vi.fn(),
  request: vi.fn(),
}));

vi.mock('vue-router', () => ({
  RouterLink: { props: ['to'], template: '<a><slot /></a>' },
  useRoute: () => ({ params: mocks.params }),
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock('../api/client.js', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return { ...actual, request: mocks.request };
});

const savedCase = {
  id: 'case-1',
  internalCode: 'NOVO-1',
  cnjNumber: null,
  cnjSegment: null,
  court: null,
  courtDivision: null,
  title: 'Caso de teste',
  description: null,
  legalArea: 'DIREITO_TRABALHISTA',
  caseType: 'RECLAMACAO_TRABALHISTA',
  status: 'INTAKE',
  priority: 'NORMAL',
  confidentialityLevel: 'STANDARD',
  responsibleUserId: null,
  responsible: null,
  processingCostLimitAmount: '0.000000',
  processingCostSpentAmount: '0.000000',
  processingCostReservedAmount: '0.000000',
  processingCostCurrency: 'BRL',
  processingBudgetStatus: 'ACTIVE',
  processingLimitReachedAt: null,
  openedAt: '2026-08-13T12:00:00.000Z',
  closedAt: null,
  createdAt: '2026-08-13T12:00:00.000Z',
  updatedAt: '2026-08-13T12:00:00.000Z',
};

describe('CaseFormView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useSessionStore().$patch({ permissions: new Set(['cases.update']) });
    mocks.params = {};
    mocks.request.mockReset();
    mocks.replace.mockReset().mockResolvedValue(undefined);
  });

  it('avisa o dígito trocado antes de o formulário ir para a API', async () => {
    mocks.request.mockResolvedValue({
      data: [],
      pageInfo: { nextCursor: null, hasNextPage: false },
    });
    const wrapper = mount(CaseFormView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    });
    await flushPromises();

    // Mesmo número do exemplo válido, com dois dígitos do sequencial trocados.
    await wrapper.get('#case-cnj-number').setValue('0001243-27.2026.5.02.0001');
    await flushPromises();

    expect(wrapper.text()).toContain('Número inválido');
  });

  it('não acusa erro enquanto a pessoa ainda está digitando', async () => {
    mocks.request.mockResolvedValue({
      data: [],
      pageInfo: { nextCursor: null, hasNextPage: false },
    });
    const wrapper = mount(CaseFormView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    });
    await flushPromises();

    await wrapper.get('#case-cnj-number').setValue('0001234-27.2026');
    await flushPromises();

    expect(wrapper.text()).not.toContain('Número inválido');
  });

  it('reconhece o segmento do Judiciário quando o número fecha', async () => {
    mocks.request.mockResolvedValue({
      data: [],
      pageInfo: { nextCursor: null, hasNextPage: false },
    });
    const wrapper = mount(CaseFormView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    });
    await flushPromises();

    await wrapper.get('#case-cnj-number').setValue('0001234-27.2026.5.02.0001');
    await flushPromises();

    expect(wrapper.text()).toContain('Justiça do Trabalho');
    expect(wrapper.text()).not.toContain('Número inválido');
  });

  it('envia o número normalizado quando ele foi colado sem pontuação', async () => {
    mocks.request.mockImplementation(async (path: string) => {
      if (path === '/users/assignable') {
        return { data: [], pageInfo: { nextCursor: null, hasNextPage: false } };
      }
      if (path === '/cases') return savedCase;
      throw new Error(`Rota inesperada: ${path}`);
    });
    const wrapper = mount(CaseFormView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    });
    await flushPromises();

    await wrapper.get('#case-internal-code').setValue('novo-1');
    await wrapper.get('#case-title-input').setValue('Caso de teste');
    await wrapper.get('#case-legal-area').setValue('Direito trabalhista');
    await wrapper.get('#case-type').setValue('Reclamação trabalhista');
    await wrapper.get('#case-cnj-number').setValue('00012342720265020001');
    await wrapper.get('#case-court').setValue('TRT da 2ª Região');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(mocks.request).toHaveBeenCalledWith(
      '/cases',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          cnjNumber: '0001234-27.2026.5.02.0001',
          court: 'TRT da 2ª Região',
          courtDivision: null,
        }),
      }),
    );
  });

  it('abre um caso com vocabulário humano e configura o teto antes de navegar', async () => {
    mocks.request.mockImplementation(async (path: string) => {
      if (path === '/users/assignable') {
        return { data: [], pageInfo: { nextCursor: null, hasNextPage: false } };
      }
      if (path === '/cases') return savedCase;
      if (path === '/cases/case-1/processing-budget') {
        return { ...savedCase, processingCostLimitAmount: '25.000000' };
      }
      throw new Error(`Rota inesperada: ${path}`);
    });
    const wrapper = mount(CaseFormView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    });
    await flushPromises();

    await wrapper.get('#case-internal-code').setValue('novo-1');
    await wrapper.get('#case-title-input').setValue('Caso de teste');
    await wrapper.get('#case-legal-area').setValue('Direito trabalhista');
    await wrapper.get('#case-type').setValue('Reclamação trabalhista');
    await wrapper.get('input[inputmode="decimal"]').setValue('25,00');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(mocks.request).toHaveBeenCalledWith(
      '/cases',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          legalArea: 'DIREITO_TRABALHISTA',
          caseType: 'RECLAMACAO_TRABALHISTA',
        }),
      }),
    );
    expect(mocks.request).toHaveBeenCalledWith('/cases/case-1/processing-budget', {
      method: 'PATCH',
      body: { limitAmount: '25.00' },
    });
    expect(mocks.replace).toHaveBeenCalledWith({
      name: 'case-detail',
      params: { id: 'case-1' },
    });
  });

  it('preenche a edição sem disparar uma alteração de teto desnecessária', async () => {
    mocks.params = { id: 'case-1' };
    mocks.request.mockImplementation(async (path: string) => {
      if (path === '/users/assignable') {
        return { data: [], pageInfo: { nextCursor: null, hasNextPage: false } };
      }
      if (path === '/cases/case-1') return savedCase;
      throw new Error(`Rota inesperada: ${path}`);
    });
    const wrapper = mount(CaseFormView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    });
    await flushPromises();

    expect(wrapper.get('h1').text()).toBe('Editar caso');
    expect(wrapper.get('input[autocomplete="off"]').element).toHaveProperty('value', 'NOVO-1');

    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(mocks.request).toHaveBeenCalledWith(
      '/cases/case-1',
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(
      mocks.request.mock.calls.some(([path]) => path === '/cases/case-1/processing-budget'),
    ).toBe(false);
  });

  it('não tenta configurar o teto quando o perfil pode criar, mas não atualizar', async () => {
    useSessionStore().clear();
    mocks.request.mockImplementation(async (path: string) => {
      if (path === '/users/assignable') {
        return { data: [], pageInfo: { nextCursor: null, hasNextPage: false } };
      }
      if (path === '/cases') return savedCase;
      throw new Error(`Rota inesperada: ${path}`);
    });
    const wrapper = mount(CaseFormView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    });
    await flushPromises();

    expect(wrapper.find('input[inputmode="decimal"]').exists()).toBe(false);
    await wrapper.get('#case-internal-code').setValue('novo-1');
    await wrapper.get('#case-title-input').setValue('Caso de teste');
    await wrapper.get('#case-legal-area').setValue('Direito trabalhista');
    await wrapper.get('#case-type').setValue('Reclamação trabalhista');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(
      mocks.request.mock.calls.some(([path]) => path === '/cases/case-1/processing-budget'),
    ).toBe(false);
  });
});
