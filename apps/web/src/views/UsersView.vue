<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { ApiError, request } from '../api/client.js';
import type {
  CreatedInvitation,
  CursorPage,
  ManagedUser,
  PendingInvitation,
} from '../api/types.js';
import StatusChip from '../components/StatusChip.vue';
import { formatLastLogin, userStatusLabels, userStatusTone } from '../domain/vocabulary.js';
import { useSessionStore } from '../stores/session.js';

/**
 * Administração das pessoas do escritório.
 *
 * A pergunta que traz alguém a esta tela é "quem tem acesso ao acervo hoje" — e a resposta
 * não é a lista, é a contagem de quem entra. Convite pendente e bloqueio aparecem no veredito
 * porque são as duas anomalias que custam caro passar despercebidas.
 */

const session = useSessionStore();
const canManage = computed(() => session.can('users.manage'));

const users = ref<ManagedUser[]>([]);
const invitations = ref<PendingInvitation[]>([]);
const loading = ref(true);
const failure = ref<ApiError | null>(null);

const form = ref({ name: '', email: '' });
const inviting = ref(false);
const inviteFailure = ref<ApiError | null>(null);
/** O token só existe nesta resposta. Some da memória assim que a pessoa fecha o aviso. */
const issued = ref<CreatedInvitation | null>(null);
const copied = ref(false);

const acting = ref<string | null>(null);

const active = computed(() => users.value.filter((user) => user.status === 'ACTIVE'));
const blocked = computed(() => users.value.filter((user) => user.status === 'BLOCKED'));

function toApiError(error: unknown, fallback: string): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError({ statusCode: 0, code: 'UNEXPECTED', message: fallback });
}

async function load(): Promise<void> {
  loading.value = true;
  failure.value = null;
  try {
    const [people, pending] = await Promise.all([
      request<CursorPage<ManagedUser>>('/users', { query: { limit: 100 } }),
      // Convites só aparecem para quem administra; sem a permissão a rota nega, e a lista
      // vazia é o resultado correto em vez de um erro de tela.
      canManage.value
        ? request<{ data: PendingInvitation[] }>('/users/invitations')
        : Promise.resolve({ data: [] }),
    ]);
    users.value = people.data;
    invitations.value = pending.data;
  } catch (error) {
    failure.value = toApiError(error, 'Não foi possível carregar a equipe do escritório.');
  } finally {
    loading.value = false;
  }
}

async function invite(): Promise<void> {
  inviting.value = true;
  inviteFailure.value = null;
  copied.value = false;
  try {
    issued.value = await request<CreatedInvitation>('/users/invitations', {
      method: 'POST',
      body: { name: form.value.name.trim(), email: form.value.email.trim(), roleIds: [] },
    });
    form.value = { name: '', email: '' };
    await load();
  } catch (error) {
    inviteFailure.value = toApiError(error, 'Não foi possível enviar o convite.');
  } finally {
    inviting.value = false;
  }
}

const inviteLink = computed(() =>
  issued.value === null
    ? ''
    : `${window.location.origin}/convite?token=${encodeURIComponent(issued.value.token)}`,
);

async function copyLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(inviteLink.value);
    copied.value = true;
  } catch {
    // Área de transferência negada é comum e não é erro de aplicação: o link segue à vista
    // para seleção manual, que é o caminho que sempre funciona.
    copied.value = false;
  }
}

async function revoke(invitation: PendingInvitation): Promise<void> {
  acting.value = invitation.id;
  try {
    await request(`/users/invitations/${invitation.id}`, { method: 'DELETE' });
    invitations.value = invitations.value.filter((row) => row.id !== invitation.id);
    await load();
  } catch (error) {
    failure.value = toApiError(error, 'Não foi possível revogar o convite.');
  } finally {
    acting.value = null;
  }
}

async function changeStatus(user: ManagedUser, status: 'ACTIVE' | 'BLOCKED'): Promise<void> {
  acting.value = user.id;
  try {
    // O servidor devolve a pessoa atualizada; trocar pelo retorno dele evita a tela e o
    // banco discordarem sobre o que acabou de acontecer.
    const updated = await request<ManagedUser>(`/users/${user.id}/status`, {
      method: 'PATCH',
      body: { status },
    });
    users.value = users.value.map((row) => (row.id === updated.id ? updated : row));
  } catch (error) {
    failure.value = toApiError(error, 'Não foi possível alterar o acesso.');
  } finally {
    acting.value = null;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <section aria-labelledby="users-title">
    <header class="head">
      <div>
        <h1 id="users-title">Equipe do escritório</h1>
        <p class="head__lede">
          Quem tem acesso ao acervo, com que papel, e desde quando. Bloquear encerra o acesso na
          hora, inclusive de quem já está com a sessão aberta.
        </p>
      </div>
    </header>

    <div v-if="loading" class="panel" aria-busy="true">
      <p class="visually-hidden">Carregando a equipe do escritório.</p>
      <div v-for="row in 5" :key="row" class="skeleton-row">
        <span class="skeleton" style="width: 26%" />
        <span class="skeleton" style="width: 30%" />
        <span class="skeleton" style="width: 14%" />
      </div>
    </div>

    <div v-else-if="failure" class="state state--error" role="alert">
      <h2 class="state__title">Não foi possível carregar a equipe</h2>
      <p class="state__body">{{ failure.message }}</p>
      <p v-if="failure.requestId" class="state__ref data">
        Referência para o suporte: {{ failure.requestId }}
      </p>
      <button class="btn" type="button" @click="load()">Tentar novamente</button>
    </div>

    <template v-else>
      <p class="verdict" :class="{ 'verdict--alert': blocked.length > 0 }" role="status">
        <strong>
          {{ active.length }}
          {{ active.length === 1 ? 'pessoa com acesso' : 'pessoas com acesso' }}.
        </strong>
        <template v-if="invitations.length > 0">
          {{ invitations.length }}
          {{ invitations.length === 1 ? 'convite aguardando' : 'convites aguardando' }}.
        </template>
        <template v-if="blocked.length > 0">
          {{ blocked.length }}
          {{ blocked.length === 1 ? 'bloqueada' : 'bloqueadas' }}.
        </template>
      </p>

      <!-- Convite entregue: o token aparece uma vez só, e a tela precisa dizer isso antes
           de a pessoa fechar o aviso e perdê-lo. -->
      <div v-if="issued" class="issued" role="status">
        <h2 class="issued__title">Convite criado para {{ issued.user.name }}</h2>
        <p class="issued__body">
          Este link aparece <strong>uma única vez</strong>. Ele vale por sete dias e serve para um
          único acesso. Entregue por um canal em que você confia — quem tiver o link entra no acervo
          do escritório.
        </p>
        <p class="issued__link data">{{ inviteLink }}</p>
        <div class="issued__actions">
          <button class="btn" type="button" @click="copyLink">
            {{ copied ? 'Link copiado' : 'Copiar link' }}
          </button>
          <button class="btn btn--ghost" type="button" @click="issued = null">
            Já entreguei, fechar
          </button>
        </div>
        <p class="issued__note">
          O sistema não envia e-mail ainda: guardamos apenas a impressão do token, então ele não
          pode ser mostrado de novo. Perdido, revogue o convite e crie outro.
        </p>
      </div>

      <form v-if="canManage" class="panel invite" @submit.prevent="invite">
        <div class="panel__bar">
          <span class="label">Convidar uma pessoa</span>
        </div>
        <div class="panel__body invite__body">
          <div class="field invite__field">
            <label class="label" for="invite-name">Nome</label>
            <input
              id="invite-name"
              v-model="form.name"
              autocomplete="off"
              :aria-invalid="inviteFailure?.detailFor('name') !== undefined"
            />
            <p v-if="inviteFailure?.detailFor('name')" class="field__error">
              {{ inviteFailure.detailFor('name') }}
            </p>
          </div>
          <div class="field invite__field">
            <label class="label" for="invite-email">E-mail</label>
            <input
              id="invite-email"
              v-model="form.email"
              type="email"
              autocomplete="off"
              :aria-invalid="inviteFailure?.detailFor('email') !== undefined"
            />
            <p v-if="inviteFailure?.detailFor('email')" class="field__error">
              {{ inviteFailure.detailFor('email') }}
            </p>
          </div>
          <button class="btn invite__go" type="submit" :disabled="inviting">
            {{ inviting ? 'Convidando…' : 'Convidar' }}
          </button>
        </div>
        <p
          v-if="inviteFailure && !inviteFailure.detailFor('email')"
          class="invite__error"
          role="alert"
        >
          {{ inviteFailure.message }}
        </p>
      </form>

      <div v-if="invitations.length > 0" class="panel">
        <div class="panel__bar">
          <span class="label">Convites aguardando aceite</span>
          <span class="data panel__count">{{ invitations.length }}</span>
        </div>
        <ul class="pending">
          <li v-for="invitation in invitations" :key="invitation.id" class="pending__row">
            <div>
              <p class="pending__name">{{ invitation.user.name }}</p>
              <p class="pending__mail data">{{ invitation.user.email }}</p>
            </div>
            <button
              v-if="canManage"
              class="btn btn--ghost"
              type="button"
              :disabled="acting === invitation.id"
              @click="revoke(invitation)"
            >
              Revogar
            </button>
          </li>
        </ul>
      </div>

      <div class="panel">
        <div class="panel__bar">
          <span class="label">Equipe</span>
          <span class="data panel__count">{{ users.length }}</span>
        </div>
        <div class="scroll-x">
          <table class="rows">
            <caption class="visually-hidden">
              Equipe do escritório com nome, e-mail, situação, papéis e último acesso.
            </caption>
            <thead>
              <tr>
                <th scope="col">Pessoa</th>
                <th scope="col">Situação</th>
                <th scope="col">Papéis</th>
                <th scope="col">Último acesso</th>
                <th v-if="canManage" scope="col" class="right">Acesso</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in users" :key="user.id">
                <td>
                  <span class="rows__title">{{ user.name }}</span>
                  <span class="rows__meta data">{{ user.email }}</span>
                </td>
                <td>
                  <StatusChip
                    :label="userStatusLabels[user.status]"
                    :tone="userStatusTone(user.status)"
                  />
                </td>
                <td>
                  <span v-if="user.roles.length === 0" class="muted">Sem papel</span>
                  <span v-else>{{ user.roles.map((role) => role.name).join(', ') }}</span>
                </td>
                <td class="nowrap">{{ formatLastLogin(user.lastLoginAt) }}</td>
                <td v-if="canManage" class="right nowrap">
                  <!-- Ninguém altera o próprio acesso: a regra é do servidor, e a tela não
                       oferece o botão para não prometer o que seria negado. -->
                  <span v-if="user.id === session.user?.id" class="muted">Você</span>
                  <button
                    v-else-if="user.status === 'BLOCKED'"
                    class="btn btn--ghost"
                    type="button"
                    :disabled="acting === user.id"
                    @click="changeStatus(user, 'ACTIVE')"
                  >
                    Reativar
                  </button>
                  <button
                    v-else-if="user.status === 'ACTIVE' || user.status === 'INVITED'"
                    class="btn btn--ghost"
                    type="button"
                    :disabled="acting === user.id"
                    @click="changeStatus(user, 'BLOCKED')"
                  >
                    Bloquear
                  </button>
                  <span v-else class="muted">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Limitação honesta: papéis existem na API mas ainda não têm seletor aqui. -->
      <p class="note">
        A troca de papéis ainda não está nesta tela: a rota existe, mas ela precisa de um seletor
        que mostre o que cada papel permite — oferecer uma lista de nomes soltos levaria alguém a
        conceder acesso sem saber a quê. Convites saem sem papel e recebem o mínimo do escritório.
      </p>
    </template>
  </section>
</template>

<style scoped>
/* Convite entregue: destacado sem alarmar, porque é sucesso com prazo de validade. */
.issued {
  background: var(--pendente-bg);
  border: 1px solid color-mix(in oklab, var(--pendente) 34%, transparent);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  margin-bottom: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  align-items: flex-start;
}

.issued__title {
  font-size: var(--step-1);
}

.issued__body {
  font-size: var(--step--1);
  color: var(--text-2);
  max-width: 68ch;
}

.issued__link {
  width: 100%;
  font-size: 0.82rem;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  padding: var(--space-3);
  overflow-wrap: anywhere;
  user-select: all;
}

.issued__actions {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.issued__note {
  font-size: 0.82rem;
  color: var(--text-3);
  max-width: 68ch;
}

.invite__body {
  display: flex;
  align-items: flex-end;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.invite__field {
  flex: 1 1 18rem;
  min-width: 0;
}

.invite__go {
  flex: none;
  padding-block: 0.6rem;
}

.invite__error {
  padding: 0 var(--space-4) var(--space-4);
  font-size: var(--step--1);
  color: var(--rejeitado);
}

.pending {
  list-style: none;
  margin: 0;
  padding: 0;
}

.pending__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line);
}

.pending__row:last-child {
  border-bottom: 0;
}

.pending__name {
  font-weight: 600;
}

.pending__mail {
  font-size: 0.82rem;
  color: var(--text-3);
}
</style>
