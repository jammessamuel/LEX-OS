import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client.js';
import AcceptInvitationView from '../views/AcceptInvitationView.vue';

const request = vi.hoisted(() => vi.fn());
const replace = vi.hoisted(() => vi.fn());
const query = vi.hoisted(() => ({ value: {} as Record<string, string> }));

vi.mock('../api/client.js', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return { ...actual, request };
});

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: query.value }),
  useRouter: () => ({ replace }),
}));

const mountView = () => mount(AcceptInvitationView);

async function fill(wrapper: ReturnType<typeof mountView>, password: string, repeat = password) {
  await wrapper.get('#password').setValue(password);
  await wrapper.get('#confirmation').setValue(repeat);
}

describe('AcceptInvitationView', () => {
  beforeEach(() => {
    request.mockReset().mockResolvedValue(undefined);
    replace.mockReset();
    query.value = { token: 'token-ficticio-de-convite' };
  });

  it('cria o acesso e leva para a entrada', async () => {
    const wrapper = mountView();
    await fill(wrapper, 'frase-ficticia-longa');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(request).toHaveBeenCalledWith('/auth/invitations/accept', {
      method: 'POST',
      body: { token: 'token-ficticio-de-convite', password: 'frase-ficticia-longa' },
      skipRefresh: true,
    });
    expect(wrapper.text()).toContain('Acesso criado');

    await wrapper.get('.accept__go').trigger('click');
    expect(replace).toHaveBeenCalledWith({ name: 'login' });
  });

  it('exige as duas senhas iguais antes de deixar concluir', async () => {
    const wrapper = mountView();
    await fill(wrapper, 'frase-ficticia-longa', 'outra-frase-ficticia');

    expect(wrapper.text()).toContain('As duas senhas estão diferentes');
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined();
    expect(request).not.toHaveBeenCalled();
  });

  it('exige o mínimo de doze caracteres antes de gastar uma tentativa', async () => {
    const wrapper = mountView();
    await fill(wrapper, 'curta');

    expect(wrapper.get('#password').attributes('aria-invalid')).toBe('true');
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined();
  });

  it('explica o link sem token em vez de mostrar um formulário inútil', async () => {
    query.value = {};

    const wrapper = mountView();

    expect(wrapper.text()).toContain('Falta o convite no link');
    expect(wrapper.text()).toContain('copiado pela metade');
    expect(wrapper.find('#password').exists()).toBe(false);
  });

  it('repassa a recusa do servidor sem inventar o motivo, e limpa a senha', async () => {
    request.mockRejectedValue(
      new ApiError({
        statusCode: 401,
        code: 'INVITATION_INVALID',
        message: 'Convite inválido ou expirado. Peça um novo ao escritório.',
        requestId: 'req-1',
      }),
    );

    const wrapper = mountView();
    await fill(wrapper, 'frase-ficticia-longa');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    const alert = wrapper.get('[role="alert"]');
    expect(alert.text()).toContain('Convite inválido ou expirado');
    expect(alert.text()).toContain('req-1');
    // A tela não pode adivinhar qual das quatro causas foi.
    expect(wrapper.text()).not.toContain('expirado há');
    expect((wrapper.get('#password').element as HTMLInputElement).value).toBe('');
  });
});
