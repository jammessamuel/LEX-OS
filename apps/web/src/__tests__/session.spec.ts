import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthTokenResponse } from '../api/types.js';
import { useSessionStore } from '../stores/session.js';

const client = vi.hoisted(() => ({
  request: vi.fn(),
  setAccessToken: vi.fn(),
}));

vi.mock('../api/client.js', () => client);

const authentication: AuthTokenResponse = {
  accessToken: 'token-ficticio',
  tokenType: 'Bearer',
  expiresIn: 900,
  user: {
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Administrador Fictício',
    email: 'admin@lexos.invalid',
  },
  organization: {
    id: '00000000-0000-4000-8000-000000000001',
    tradeName: 'Lex OS Demonstração',
  },
  permissions: ['cases.read', 'documents.read'],
};

describe('sessão web', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    client.request.mockReset();
    client.setAccessToken.mockReset();
  });

  it('não tenta renovar uma sessão antiga quando o login é recusado', async () => {
    client.request.mockRejectedValueOnce(new Error('credenciais inválidas'));
    const session = useSessionStore();
    const input = {
      organizationSlug: 'lex-os-demonstracao',
      email: authentication.user.email,
      password: 'senha-ficticia',
    };

    await expect(session.login(input)).rejects.toThrow('credenciais inválidas');

    expect(client.request).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: input,
      skipRefresh: true,
    });
  });

  it('não chama a renovação recursivamente ao restaurar uma sessão expirada', async () => {
    client.request.mockRejectedValueOnce(new Error('sessão expirada'));
    const session = useSessionStore();

    await session.restore();

    expect(client.request).toHaveBeenCalledTimes(1);
    expect(client.request).toHaveBeenCalledWith('/auth/refresh', {
      method: 'POST',
      skipRefresh: true,
    });
    expect(session.isAuthenticated).toBe(false);
    expect(session.restoring).toBe(false);
  });

  it('expõe somente as permissões recebidas da sessão e as limpa ao sair', async () => {
    client.request.mockResolvedValueOnce(authentication);
    const session = useSessionStore();

    await session.login({
      organizationSlug: 'lex-os-demonstracao',
      email: authentication.user.email,
      password: 'senha-ficticia',
    });

    expect(session.can('cases.read')).toBe(true);
    expect(session.can('audit.read')).toBe(false);

    session.clear();
    expect(session.can('cases.read')).toBe(false);
  });
});
