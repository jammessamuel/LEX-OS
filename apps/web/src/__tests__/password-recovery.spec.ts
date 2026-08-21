import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client.js';
import ForgotPasswordView from '../views/ForgotPasswordView.vue';
import NewPasswordView from '../views/NewPasswordView.vue';

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

const stubs = { RouterLink: { template: '<a><slot /></a>' } };

describe('ForgotPasswordView', () => {
  const mountView = () => mount(ForgotPasswordView, { global: { stubs } });

  async function ask(wrapper: ReturnType<typeof mountView>) {
    await wrapper.get('#organizationSlug').setValue('souza-cabral');
    await wrapper.get('#email').setValue('ana@escritorio.invalid');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
  }

  beforeEach(() => {
    request.mockReset().mockResolvedValue(undefined);
    window.localStorage.clear();
  });

  it('confirma sem revelar se a conta existe', async () => {
    const wrapper = mountView();
    await ask(wrapper);

    const text = wrapper.text();
    // "Se houver" é o ponto: a tela não sabe, e não pode fingir que sabe.
    expect(text).toContain('Se houver uma conta ativa');
    expect(text).toContain('vale por uma hora');
    expect(text).not.toContain('não encontrado');
    expect(text).not.toContain('enviado para');
  });

  it('envia escritório e e-mail normalizados', async () => {
    const wrapper = mountView();
    await wrapper.get('#organizationSlug').setValue('  Souza-Cabral  ');
    await wrapper.get('#email').setValue('  ANA@escritorio.invalid ');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(request).toHaveBeenCalledWith('/auth/password-reset', {
      method: 'POST',
      body: { organizationSlug: 'souza-cabral', email: 'ana@escritorio.invalid' },
      skipRefresh: true,
    });
  });

  it('preenche a partir do que o dispositivo lembra', async () => {
    window.localStorage.setItem(
      'lex-os.entrada',
      JSON.stringify({ organizationSlug: 'souza-cabral', email: 'ana@escritorio.invalid' }),
    );

    const wrapper = mountView();

    expect((wrapper.get('#email').element as HTMLInputElement).value).toBe(
      'ana@escritorio.invalid',
    );
  });

  it('distingue o limite de tentativas, que é informação para o próprio usuário', async () => {
    request.mockRejectedValue(
      new ApiError({
        statusCode: 429,
        code: 'AUTH_RATE_LIMITED',
        message: 'Muitas tentativas de acesso. Tente novamente mais tarde.',
      }),
    );

    const wrapper = mountView();
    await ask(wrapper);

    const alert = wrapper.get('[role="alert"]');
    expect(alert.text()).toContain('pedidos demais para este e-mail');
    expect(alert.text()).toContain('pode ainda estar valendo');
    // Continua sem confirmar nada sobre a existência da conta.
    expect(wrapper.text()).not.toContain('Se houver uma conta ativa');
  });

  it('não deixa enviar com escritório em formato inválido', async () => {
    const wrapper = mountView();
    await wrapper.get('#organizationSlug').setValue('Escritório Inválido');
    await wrapper.get('#email').setValue('ana@escritorio.invalid');

    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined();
    expect(request).not.toHaveBeenCalled();
  });
});

describe('NewPasswordView', () => {
  const mountView = () => mount(NewPasswordView, { global: { stubs } });

  beforeEach(() => {
    request.mockReset().mockResolvedValue(undefined);
    replace.mockReset();
    query.value = { token: 'token-ficticio-de-redefinicao' };
    window.localStorage.clear();
  });

  it('salva a nova senha e avisa que as outras sessões caíram', async () => {
    const wrapper = mountView();
    await wrapper.get('#password').setValue('frase-ficticia-longa');
    await wrapper.get('#confirmation').setValue('frase-ficticia-longa');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(request).toHaveBeenCalledWith('/auth/password-reset/complete', {
      method: 'POST',
      body: { token: 'token-ficticio-de-redefinicao', password: 'frase-ficticia-longa' },
      skipRefresh: true,
    });
    expect(wrapper.text()).toContain('Senha alterada');
    expect(wrapper.text()).toContain('foram encerradas');
  });

  it('esquece a identidade guardada, cuja sessão não existe mais', async () => {
    window.localStorage.setItem(
      'lex-os.entrada',
      JSON.stringify({
        organizationSlug: 'souza-cabral',
        email: 'ana@escritorio.invalid',
        keepSignedIn: true,
        lastRoute: '/casos/case-1',
      }),
    );

    const wrapper = mountView();
    await wrapper.get('#password').setValue('frase-ficticia-longa');
    await wrapper.get('#confirmation').setValue('frase-ficticia-longa');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    const saved = JSON.parse(window.localStorage.getItem('lex-os.entrada') ?? '{}');
    expect(saved.email).toBe('');
    expect(saved.lastRoute).toBeNull();
    // O escritório fica: é do dispositivo, não da pessoa.
    expect(saved.organizationSlug).toBe('souza-cabral');
  });

  it('exige as duas senhas iguais e o mínimo de doze caracteres', async () => {
    const wrapper = mountView();
    await wrapper.get('#password').setValue('curta');
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined();

    await wrapper.get('#password').setValue('frase-ficticia-longa');
    await wrapper.get('#confirmation').setValue('outra-frase-ficticia');
    expect(wrapper.text()).toContain('As duas senhas estão diferentes');
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined();
  });

  it('explica o link sem código em vez de mostrar um formulário inútil', async () => {
    query.value = {};

    const wrapper = mountView();

    expect(wrapper.text()).toContain('Falta o código no link');
    expect(wrapper.find('#password').exists()).toBe(false);
  });

  it('repassa a recusa do servidor sem inventar o motivo, e limpa os campos', async () => {
    request.mockRejectedValue(
      new ApiError({
        statusCode: 401,
        code: 'PASSWORD_RESET_INVALID',
        message: 'Pedido inválido ou expirado. Solicite uma nova redefinição.',
      }),
    );

    const wrapper = mountView();
    await wrapper.get('#password').setValue('frase-ficticia-longa');
    await wrapper.get('#confirmation').setValue('frase-ficticia-longa');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain('inválido ou expirado');
    // A tela não pode adivinhar qual das quatro causas foi.
    expect(wrapper.text()).not.toContain('já foi usado');
    expect((wrapper.get('#password').element as HTMLInputElement).value).toBe('');
  });
});
