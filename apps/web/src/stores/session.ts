import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { request, setAccessToken, type NoContent } from '../api/client.js';
import type {
  AuthenticatedOrganization,
  AuthenticatedUser,
  AuthTokenResponse,
} from '../api/types.js';

/**
 * Sessão autenticada.
 *
 * O token de acesso vive apenas em memória: nada de localStorage, para que um XSS não
 * consiga persistir credencial. A continuidade entre recarregamentos vem do cookie de
 * atualização, que é HttpOnly e o JavaScript não enxerga.
 */
export const useSessionStore = defineStore('session', () => {
  const user = ref<AuthenticatedUser | null>(null);
  const organization = ref<AuthenticatedOrganization | null>(null);
  const permissions = ref<ReadonlySet<string>>(new Set());
  const restoring = ref(true);

  const isAuthenticated = computed(() => user.value !== null);

  function apply(response: AuthTokenResponse): void {
    setAccessToken(response.accessToken);
    user.value = response.user;
    organization.value = response.organization;
    permissions.value = new Set(response.permissions);
  }

  function clear(): void {
    setAccessToken(null);
    user.value = null;
    organization.value = null;
    permissions.value = new Set();
  }

  function can(permission: string): boolean {
    return permissions.value.has(permission);
  }

  async function login(input: {
    organizationId: string;
    email: string;
    password: string;
  }): Promise<void> {
    apply(
      await request<AuthTokenResponse>('/auth/login', {
        method: 'POST',
        body: input,
        skipRefresh: true,
      }),
    );
  }

  /**
   * Tenta reconstruir a sessão a partir do cookie de atualização. Chamado uma vez na
   * inicialização; falhar aqui é o caso normal de quem não está autenticado.
   */
  async function restore(): Promise<void> {
    restoring.value = true;
    try {
      apply(
        await request<AuthTokenResponse>('/auth/refresh', {
          method: 'POST',
          skipRefresh: true,
        }),
      );
    } catch {
      clear();
    } finally {
      restoring.value = false;
    }
  }

  async function logout(): Promise<void> {
    try {
      await request<NoContent>('/auth/logout', { method: 'POST' });
    } catch {
      // Encerrar a sessão local é o que importa; a revogação no servidor expira sozinha.
    } finally {
      clear();
    }
  }

  return {
    user,
    organization,
    permissions,
    restoring,
    isAuthenticated,
    can,
    login,
    logout,
    restore,
    clear,
  };
});
