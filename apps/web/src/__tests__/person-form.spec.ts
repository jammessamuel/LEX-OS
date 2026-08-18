import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PersonFormView from '../views/PersonFormView.vue';

const request = vi.hoisted(() => vi.fn());
const routeParams = vi.hoisted(() => ({ id: undefined as string | undefined }));
const replace = vi.hoisted(() => vi.fn());

vi.mock('../api/client.js', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return { ...actual, request };
});

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: routeParams }),
  useRouter: () => ({ replace }),
}));

const saved = {
  id: 'p-1',
  personType: 'INDIVIDUAL',
  fullName: 'Pessoa Fictícia de Teste',
  tradeName: null,
  cpf: '***.***.***-35',
  cnpj: null,
  rg: null,
  birthDate: null,
  email: null,
  phone: null,
  occupation: null,
  maritalStatus: null,
  createdAt: '2026-08-12T12:00:00.000Z',
  updatedAt: '2026-08-12T12:00:00.000Z',
};

const stubs = { RouterLink: { template: '<a><slot /></a>' } };
const mountView = () => mount(PersonFormView, { global: { stubs } });

describe('PersonFormView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    request.mockReset();
    replace.mockReset();
    routeParams.id = undefined;
  });

  it('cria a pessoa enviando somente os documentos digitados', async () => {
    request.mockResolvedValue(saved);

    const wrapper = mountView();
    await wrapper.get('input[required]').setValue('Pessoa Fictícia de Teste');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    const [path, options] = request.mock.calls[0] as [
      string,
      { method: string; body: Record<string, unknown> },
    ];
    expect(path).toBe('/persons');
    expect(options.method).toBe('POST');
    expect(options.body.fullName).toBe('Pessoa Fictícia de Teste');
    // Documento vazio não viaja: nem string vazia, nem null implícito.
    expect(options.body).not.toHaveProperty('cpf');
    expect(options.body).not.toHaveProperty('cnpj');
    expect(options.body).not.toHaveProperty('rg');
    expect(replace).toHaveBeenCalledWith({ name: 'person-detail', params: { id: 'p-1' } });
  });

  it('na edição não reenvia a máscara: documento intocado fica fora do PATCH', async () => {
    routeParams.id = 'p-1';
    request.mockResolvedValue(saved);

    const wrapper = mountView();
    await flushPromises();

    // O CPF mascarado vira dica no campo, nunca valor.
    const cpfInput = wrapper.get('input[inputmode="numeric"]');
    expect((cpfInput.element as HTMLInputElement).value).toBe('');
    expect(cpfInput.attributes('placeholder')).toBe('***.***.***-35');

    request.mockClear();
    request.mockResolvedValue(saved);
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    const [path, options] = request.mock.calls[0] as [
      string,
      { method: string; body: Record<string, unknown> },
    ];
    expect(path).toBe('/persons/p-1');
    expect(options.method).toBe('PATCH');
    expect(options.body).not.toHaveProperty('cpf');
  });

  it('envia o documento quando o usuário digita um novo valor', async () => {
    routeParams.id = 'p-1';
    request.mockResolvedValue(saved);

    const wrapper = mountView();
    await flushPromises();

    await wrapper.get('input[inputmode="numeric"]').setValue('39053344705');
    request.mockClear();
    request.mockResolvedValue(saved);
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    const [, options] = request.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(options.body.cpf).toBe('39053344705');
  });
});
