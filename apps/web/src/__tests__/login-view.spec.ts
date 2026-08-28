import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client.js';
import LoginView from '../views/LoginView.vue';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  replace: vi.fn(),
  query: {} as { destino?: string; escritorio?: string },
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: mocks.query }),
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock('../stores/session.js', () => ({
  useSessionStore: () => ({ login: mocks.login }),
}));

async function submitLogin() {
  const wrapper = mount(LoginView);
  await wrapper.get('#organizationSlug').setValue(' Souza-Cabral ');
  await wrapper.get('#email').setValue(' pessoa@exemplo.test ');
  await wrapper.get('#password').setValue('senha-ficticia');
  await wrapper.get('form').trigger('submit');
  await flushPromises();
  return wrapper;
}

describe('LoginView', () => {
  beforeEach(() => {
    mocks.login.mockReset().mockResolvedValue(undefined);
    mocks.replace.mockReset().mockResolvedValue(undefined);
    delete mocks.query.destino;
    window.localStorage.clear();
  });

  it('retorna à rota interna que o usuário tentou abrir antes da autenticação', async () => {
    mocks.query.destino = '/casos/case-1?aba=documentos';

    await submitLogin();

    expect(mocks.login).toHaveBeenCalledWith({
      organizationSlug: 'souza-cabral',
      email: 'pessoa@exemplo.test',
      password: 'senha-ficticia',
      keepSignedIn: false,
    });
    expect(mocks.replace).toHaveBeenCalledWith('/casos/case-1?aba=documentos');
  });

  it.each(['https://site-malicioso.test', '//site-malicioso.test'])(
    'ignora destino externo ou ambíguo (%s) e abre a lista de casos',
    async (destination) => {
      mocks.query.destino = destination;

      await submitLogin();

      expect(mocks.replace).toHaveBeenCalledWith({ name: 'cases' });
    },
  );

  it('normaliza o escritório digitado: quem entra não precisa acertar a caixa', async () => {
    await submitLogin();

    expect(mocks.login).toHaveBeenCalledWith(
      expect.objectContaining({ organizationSlug: 'souza-cabral' }),
    );
  });

  it('preenche o escritório vindo do link de convite, que é identificador e não conteúdo', async () => {
    mocks.query.escritorio = 'souza-cabral';

    const wrapper = mount(LoginView);

    expect((wrapper.get('#organizationSlug').element as HTMLInputElement).value).toBe(
      'souza-cabral',
    );
    delete mocks.query.escritorio;
  });

  it('guarda escritório e e-mail sem persistir a senha', async () => {
    await submitLogin();

    const saved = JSON.parse(window.localStorage.getItem('lex-os.entrada') ?? '{}');
    expect(saved.organizationSlug).toBe('souza-cabral');
    expect(saved.email).toBe('pessoa@exemplo.test');
    // Credencial fica com o gerenciador do navegador, nunca com o JavaScript da aplicação.
    expect(JSON.stringify(saved)).not.toContain('senha-ficticia');
  });

  it('remove do disco uma senha legada assim que lê as preferências', async () => {
    window.localStorage.setItem(
      'lex-os.entrada',
      JSON.stringify({
        organizationSlug: 'souza-cabral',
        email: 'pessoa@exemplo.test',
        savePassword: true,
        password: 'senha-ficticia',
      }),
    );

    const wrapper = mount(LoginView);
    expect((wrapper.get('#password').element as HTMLInputElement).value).toBe('');

    const saved = JSON.parse(window.localStorage.getItem('lex-os.entrada') ?? '{}');
    expect(saved).not.toHaveProperty('savePassword');
    expect(saved).not.toHaveProperty('password');
  });

  it('preenche o formulário na volta, deixando só a senha para digitar', async () => {
    window.localStorage.setItem(
      'lex-os.entrada',
      JSON.stringify({
        organizationSlug: 'souza-cabral',
        email: 'pessoa@exemplo.test',
        keepSignedIn: true,
      }),
    );

    const wrapper = mount(LoginView);

    expect((wrapper.get('#organizationSlug').element as HTMLInputElement).value).toBe(
      'souza-cabral',
    );
    expect((wrapper.get('#email').element as HTMLInputElement).value).toBe('pessoa@exemplo.test');
    expect((wrapper.get('#password').element as HTMLInputElement).value).toBe('');
    expect((wrapper.get('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(true);
  });

  it('não guarda nada quando a entrada falha', async () => {
    mocks.login.mockRejectedValueOnce(new Error('credenciais inválidas'));

    await submitLogin();

    expect(window.localStorage.getItem('lex-os.entrada')).toBeNull();
  });

  it('declara os atributos que o gerenciador de senhas do navegador precisa', async () => {
    const wrapper = mount(LoginView);

    expect(wrapper.get('#email').attributes('autocomplete')).toBe('username');
    expect(wrapper.get('#email').attributes('name')).toBe('username');
    expect(wrapper.get('#password').attributes('autocomplete')).toBe('current-password');
    expect(wrapper.get('#password').attributes('type')).toBe('password');
  });

  it('envia a escolha de continuar conectado ao servidor', async () => {
    const wrapper = mount(LoginView);
    await wrapper.get('input[type="checkbox"]').setValue(true);
    await wrapper.get('#organizationSlug').setValue('souza-cabral');
    await wrapper.get('#email').setValue('pessoa@exemplo.test');
    await wrapper.get('#password').setValue('senha-ficticia');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(mocks.login).toHaveBeenCalledWith(expect.objectContaining({ keepSignedIn: true }));
  });

  it('pede o código quando a senha está certa e o segundo fator está ativo', async () => {
    mocks.login.mockRejectedValueOnce(
      new ApiError({
        statusCode: 401,
        code: 'SECOND_FACTOR_REQUIRED',
        message: 'Informe o código do segundo fator para concluir a entrada.',
      }),
    );

    const wrapper = await submitLogin();

    // Não é erro: a senha foi aceita, e a tela avança em vez de acusar credencial errada.
    expect(wrapper.text()).toContain('Senha conferida');
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.find('#secondFactorCode').exists()).toBe(true);
    expect(wrapper.find('#password').exists()).toBe(false);
  });

  it('envia o código no segundo passo, sem pedir a senha de novo', async () => {
    mocks.login.mockRejectedValueOnce(
      new ApiError({ statusCode: 401, code: 'SECOND_FACTOR_REQUIRED', message: 'x' }),
    );
    const wrapper = await submitLogin();

    mocks.login.mockResolvedValueOnce(undefined);
    await wrapper.get('#secondFactorCode').setValue('123456');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(mocks.login).toHaveBeenLastCalledWith(
      expect.objectContaining({
        password: 'senha-ficticia',
        secondFactorCode: '123456',
      }),
    );
    expect(mocks.replace).toHaveBeenCalled();
  });

  it('código errado não apaga a senha já conferida', async () => {
    mocks.login.mockRejectedValueOnce(
      new ApiError({ statusCode: 401, code: 'SECOND_FACTOR_REQUIRED', message: 'x' }),
    );
    const wrapper = await submitLogin();

    mocks.login.mockRejectedValueOnce(
      new ApiError({
        statusCode: 401,
        code: 'SECOND_FACTOR_CODE_INVALID',
        message: 'Código inválido. Confira o aplicativo e tente de novo.',
      }),
    );
    await wrapper.get('#secondFactorCode').setValue('000000');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain('Código inválido');
    // Refazer a senha inteira seria castigo por erro de digitação no código.
    expect(wrapper.find('#secondFactorCode').exists()).toBe(true);
    expect((wrapper.get('#secondFactorCode').element as HTMLInputElement).value).toBe('');
  });
});
