import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LoginView from '../views/LoginView.vue';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  replace: vi.fn(),
  query: {} as { destino?: string },
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
  await wrapper.get('#organizationId').setValue(' org-1 ');
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
      organizationId: 'org-1',
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
});
