import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PersonsView from '../views/PersonsView.vue';
import { useSessionStore } from '../stores/session.js';

const request = vi.hoisted(() => vi.fn());

vi.mock('../api/client.js', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return { ...actual, request };
});

function person(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p-1',
    personType: 'INDIVIDUAL',
    fullName: 'Pessoa Fictícia de Teste',
    tradeName: null,
    cpf: '***.***.***-35',
    cnpj: null,
    rg: null,
    birthDate: null,
    email: 'pessoa@exemplo.invalid',
    phone: null,
    occupation: null,
    maritalStatus: null,
    createdAt: '2026-08-12T12:00:00.000Z',
    updatedAt: '2026-08-12T12:00:00.000Z',
    ...overrides,
  };
}

function page(data: unknown[], hasNextPage = false) {
  return { data, pageInfo: { nextCursor: hasNextPage ? 'cursor-1' : null, hasNextPage } };
}

const stubs = { RouterLink: { template: '<a><slot /></a>' } };
const mountView = () => mount(PersonsView, { global: { stubs } });

describe('PersonsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useSessionStore().$patch({ permissions: new Set(['persons.read', 'persons.manage']) });
    request.mockReset();
  });

  it('lista as pessoas com tipo traduzido e documento mascarado como veio da API', async () => {
    request.mockResolvedValue(
      page([
        person(),
        person({
          id: 'p-2',
          personType: 'COMPANY',
          fullName: 'Empresa Fictícia Ltda.',
          tradeName: 'Fictícia',
          cpf: null,
          cnpj: '**.***.***/****-81',
          email: null,
        }),
      ]),
    );

    const wrapper = mountView();
    await flushPromises();

    const text = wrapper.text();
    expect(text).toContain('Pessoa Fictícia de Teste');
    expect(text).toContain('Pessoa física');
    expect(text).toContain('***.***.***-35');
    expect(text).toContain('Empresa Fictícia Ltda.');
    expect(text).toContain('Pessoa jurídica');
    expect(text).toContain('**.***.***/****-81');
  });

  it('explica o vazio e oferece o cadastro como próxima ação', async () => {
    request.mockResolvedValue(page([]));

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Nenhuma pessoa cadastrada');
    expect(wrapper.text()).toContain('Cadastrar a primeira pessoa');
  });

  it('não oferece cadastro a quem não pode gerenciar pessoas', async () => {
    setActivePinia(createPinia());
    useSessionStore().$patch({ permissions: new Set(['persons.read']) });
    request.mockResolvedValue(page([]));

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).not.toContain('Cadastrar pessoa');
  });

  it('mostra o erro recuperável com nova tentativa em vez de lista vazia', async () => {
    request.mockRejectedValue(new Error('rede'));

    const wrapper = mountView();
    await flushPromises();

    const alert = wrapper.get('[role="alert"]');
    expect(alert.text()).toContain('Não foi possível carregar as pessoas');
    expect(alert.text()).toContain('Tentar novamente');
  });

  it('carrega a próxima página sem descartar as pessoas já na tela', async () => {
    request.mockResolvedValueOnce(page([person()], true));

    const wrapper = mountView();
    await flushPromises();

    request.mockResolvedValueOnce(page([person({ id: 'p-3', fullName: 'Outra Pessoa Fictícia' })]));
    await wrapper.get('.panel__more button').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Pessoa Fictícia de Teste');
    expect(wrapper.text()).toContain('Outra Pessoa Fictícia');
    expect(wrapper.find('.panel__more').exists()).toBe(false);
  });
});
