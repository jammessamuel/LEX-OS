import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UsersView from '../views/UsersView.vue';

const request = vi.hoisted(() => vi.fn());
const store = vi.hoisted(() => ({
  permissions: new Set<string>(),
  user: { id: 'eu', name: 'Administradora Fictícia', email: 'admin@lexos.invalid' },
}));

vi.mock('../api/client.js', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return { ...actual, request };
});

vi.mock('../stores/session.js', () => ({
  useSessionStore: () => ({
    user: store.user,
    can: (permission: string) => store.permissions.has(permission),
  }),
}));

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u-1',
    name: 'Ana Fictícia',
    email: 'ana@escritorio.invalid',
    status: 'ACTIVE',
    lastLoginAt: null,
    roles: [{ id: 'r-1', name: 'Advogada', code: 'LAWYER' }],
    ...overrides,
  };
}

function role(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r-1',
    name: 'Advogada',
    code: 'LAWYER',
    description: 'Acesso jurídico completo aos casos autorizados.',
    grantable: true,
    permissions: [
      { code: 'cases.read', description: 'Visualizar casos autorizados.' },
      { code: 'documents.manage', description: 'Enviar, classificar e atualizar documentos.' },
    ],
    ...overrides,
  };
}

function mockLoad(users: unknown[], invitations: unknown[] = [], catalogue: unknown[] = [role()]) {
  request.mockImplementation(async (path: string) => {
    if (path === '/users')
      return { data: users, pageInfo: { nextCursor: null, hasNextPage: false } };
    if (path === '/users/invitations') return { data: invitations };
    if (path === '/roles') return { data: catalogue };
    throw new Error(`rota inesperada: ${path}`);
  });
}

const mountView = () => mount(UsersView, { global: { stubs: { RouterLink: true } } });

describe('UsersView', () => {
  beforeEach(() => {
    request.mockReset();
    store.permissions = new Set(['users.read', 'users.manage']);
  });

  it('responde primeiro quem tem acesso, e alarma só quando há bloqueio', async () => {
    mockLoad(
      [user(), user({ id: 'u-2', status: 'BLOCKED' })],
      [
        {
          id: 'i-1',
          user: user({ id: 'u-3', status: 'INVITED' }),
          expiresAt: '2026-08-27T00:00:00.000Z',
        },
      ],
    );

    const wrapper = mountView();
    await flushPromises();

    const verdict = wrapper.get('[role="status"]');
    expect(verdict.text()).toContain('1 pessoa com acesso');
    expect(verdict.text()).toContain('1 convite aguardando');
    expect(verdict.text()).toContain('1 bloqueada');
    expect(verdict.classes()).toContain('verdict--alert');
  });

  it('não vaza rótulo técnico de situação', async () => {
    mockLoad([user({ status: 'INVITED' })]);

    const wrapper = mountView();
    await flushPromises();
    const text = wrapper.text();

    expect(text).toContain('Convidada');
    expect(text).not.toContain('INVITED');
    expect(text).not.toContain('ACTIVE');
  });

  it('mostra o link do convite uma vez, dizendo que ele não volta', async () => {
    mockLoad([user()]);
    const wrapper = mountView();
    await flushPromises();

    request.mockImplementationOnce(async () => ({
      id: 'i-9',
      user: user({ id: 'u-9', name: 'Bruno Fictício', status: 'INVITED' }),
      expiresAt: '2026-08-27T00:00:00.000Z',
      token: 'token-ficticio-de-convite',
    }));
    await wrapper.get('#invite-name').setValue('Bruno Fictício');
    await wrapper.get('#invite-email').setValue('bruno@escritorio.invalid');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    const text = wrapper.text();
    expect(text).toContain('Convite criado para Bruno Fictício');
    expect(text).toContain('uma única vez');
    expect(text).toContain('token-ficticio-de-convite');
    // A ausência de e-mail é dita, não escondida.
    expect(text).toContain('não envia e-mail ainda');
  });

  it('some com o token da tela quando quem convidou confirma a entrega', async () => {
    mockLoad([user()]);
    const wrapper = mountView();
    await flushPromises();

    request.mockImplementationOnce(async () => ({
      id: 'i-9',
      user: user({ id: 'u-9', status: 'INVITED' }),
      expiresAt: '2026-08-27T00:00:00.000Z',
      token: 'token-ficticio-de-convite',
    }));
    await wrapper.get('#invite-name').setValue('Bruno Fictício');
    await wrapper.get('#invite-email').setValue('bruno@escritorio.invalid');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('token-ficticio-de-convite');

    await wrapper.get('.issued__actions .btn--ghost').trigger('click');
    expect(wrapper.text()).not.toContain('token-ficticio-de-convite');
  });

  it('não oferece bloquear a si mesmo, porque o servidor recusaria', async () => {
    mockLoad([user({ id: 'eu', name: 'Administradora Fictícia' }), user({ id: 'u-2' })]);

    const wrapper = mountView();
    await flushPromises();

    const rows = wrapper.findAll('tbody tr');
    expect(rows.at(0)?.text()).toContain('Você');
    expect(rows.at(0)?.find('.btn--ghost').exists()).toBe(false);
    expect(rows.at(1)?.get('.btn--ghost').text()).toBe('Bloquear');
  });

  it('troca a pessoa pelo retorno do servidor ao bloquear', async () => {
    mockLoad([user({ id: 'u-2' })]);
    const wrapper = mountView();
    await flushPromises();

    request.mockImplementationOnce(async () => user({ id: 'u-2', status: 'BLOCKED' }));
    await wrapper.get('tbody tr .btn--ghost').trigger('click');
    await flushPromises();

    expect(request).toHaveBeenLastCalledWith('/users/u-2/status', {
      method: 'PATCH',
      body: { status: 'BLOCKED' },
    });
    expect(wrapper.text()).toContain('Bloqueada');
    expect(wrapper.get('tbody tr .btn--ghost').text()).toBe('Reativar');
  });

  it('sem users.manage, mostra a equipe e esconde toda ação de escrita', async () => {
    store.permissions = new Set(['users.read']);
    mockLoad([user()]);

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Ana Fictícia');
    expect(wrapper.find('#invite-name').exists()).toBe(false);
    expect(wrapper.findAll('tbody .btn--ghost')).toHaveLength(0);
    expect(wrapper.find('.roles__open').exists()).toBe(false);
    // Sem a permissão, a rota de convites nem é chamada.
    expect(request.mock.calls.some(([path]) => path === '/users/invitations')).toBe(false);
  });

  it('mostra o que cada papel permite antes de deixar escolher', async () => {
    mockLoad([user({ id: 'u-2' })]);
    const wrapper = mountView();
    await flushPromises();

    await wrapper.get('.roles__open').trigger('click');
    const editor = wrapper.get('.roles');

    expect(editor.text()).toContain('Papéis de Ana Fictícia');
    // A promessa do seletor: a permissão aparece em português, não o código dela.
    expect(editor.text()).toContain('Visualizar casos autorizados.');
    expect(editor.text()).toContain('Enviar, classificar e atualizar documentos.');
    expect(editor.text()).not.toContain('cases.read');
  });

  it('desabilita o papel que quem administra não pode conceder, e diz por quê', async () => {
    mockLoad(
      [user({ id: 'u-2' })],
      [],
      [role(), role({ id: 'r-2', name: 'Administradora', grantable: false })],
    );
    const wrapper = mountView();
    await flushPromises();
    await wrapper.get('.roles__open').trigger('click');

    const items = wrapper.findAll('.roles__item');
    expect(items.at(1)?.text()).toContain('não pode conceder este papel');
    expect((items.at(1)?.find('input').element as HTMLInputElement).disabled).toBe(true);
    expect((items.at(0)?.find('input').element as HTMLInputElement).disabled).toBe(false);
  });

  it('envia o conjunto inteiro de papéis, não um acréscimo', async () => {
    mockLoad([user({ id: 'u-2' })], [], [role(), role({ id: 'r-2', name: 'Estagiária' })]);
    const wrapper = mountView();
    await flushPromises();
    await wrapper.get('.roles__open').trigger('click');

    // A pessoa já tem r-1; tirar r-1 e pôr r-2 tem de resultar em [r-2] apenas.
    const boxes = wrapper.findAll('.roles__item input');
    await boxes.at(0)?.trigger('change');
    await boxes.at(1)?.trigger('change');

    request.mockImplementationOnce(async () =>
      user({ id: 'u-2', roles: [{ id: 'r-2', name: 'Estagiária', code: 'INTERN' }] }),
    );
    await wrapper.get('.roles__actions .btn').trigger('click');
    await flushPromises();

    expect(request).toHaveBeenLastCalledWith('/users/u-2/roles', {
      method: 'PATCH',
      body: { roleIds: ['r-2'] },
    });
    expect(wrapper.text()).toContain('Estagiária');
    expect(wrapper.find('.roles').exists()).toBe(false);
  });

  it('não oferece alterar os próprios papéis', async () => {
    mockLoad([user({ id: 'eu' })]);
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.find('.roles__open').exists()).toBe(false);
  });

  it('falha ao carregar vira erro recuperável, não lista vazia', async () => {
    request.mockRejectedValue(new Error('rede fora'));

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain('Não foi possível carregar a equipe');
    expect(wrapper.find('tbody').exists()).toBe(false);
  });
});
