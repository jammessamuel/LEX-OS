import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  });

  it('retorna à rota interna que o usuário tentou abrir antes da autenticação', async () => {
    mocks.query.destino = '/casos/case-1?aba=documentos';

    await submitLogin();

    expect(mocks.login).toHaveBeenCalledWith({
      organizationSlug: 'souza-cabral',
      email: 'pessoa@exemplo.test',
      password: 'senha-ficticia',
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
});
