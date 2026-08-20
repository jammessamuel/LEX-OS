<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { ApiError, request } from '../api/client.js';
import type {
  AssignableRole,
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

const roles = ref<AssignableRole[]>([]);
/** Pessoa cujo conjunto de papéis está aberto para edição. Uma por vez, de propósito. */
const editing = ref<ManagedUser | null>(null);
const selected = ref<Set<string>>(new Set());
const savingRoles = ref(false);
const rolesFailure = ref<ApiError | null>(null);

function openRoles(user: ManagedUser): void {
  editing.value = user;
  selected.value = new Set(user.roles.map((role) => role.id));
  rolesFailure.value = null;
}

function toggleRole(role: AssignableRole): void {
  const next = new Set(selected.value);
  if (next.has(role.id)) {
    next.delete(role.id);
  } else {
    next.add(role.id);
  }
  selected.value = next;
}

async function saveRoles(): Promise<void> {
  const target = editing.value;
  if (target === null) {
    return;
  }
  savingRoles.value = true;
  rolesFailure.value = null;
  try {
    const updated = await request<ManagedUser>(`/users/${target.id}/roles`, {
      method: 'PATCH',
      body: { roleIds: [...selected.value] },
    });
    users.value = users.value.map((row) => (row.id === updated.id ? updated : row));
    editing.value = null;
  } catch (error) {
    rolesFailure.value = toApiError(error, 'Não foi possível alterar os papéis.');
  } finally {
    savingRoles.value = false;
  }
}

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
    const [people, pending, catalogue] = await Promise.all([
      request<CursorPage<ManagedUser>>('/users', { query: { limit: 100 } }),
      // Convites só aparecem para quem administra; sem a permissão a rota nega, e a lista
      // vazia é o resultado correto em vez de um erro de tela.
      canManage.value
        ? request<{ data: PendingInvitation[] }>('/users/invitations')
        : Promise.resolve({ data: [] }),
      canManage.value
        ? request<{ data: AssignableRole[] }>('/roles')
        : Promise.resolve({ data: [] }),
    ]);
    users.value = people.data;
    invitations.value = pending.data;
    roles.value = catalogue.data;
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

      <!-- Um papel só é escolhível depois de dizer o que ele permite. Uma lista de nomes
           soltos levaria alguém a conceder acesso ao acervo sem saber a quê. -->
      <div v-if="editing" class="panel roles" role="group" aria-labelledby="roles-title">
        <div class="panel__bar">
          <span id="roles-title" class="label">Papéis de {{ editing.name }}</span>
          <span class="data panel__count">{{ selected.size }} selecionados</span>
        </div>

        <ul class="roles__list">
          <li v-for="role in roles" :key="role.id" class="roles__item">
            <label class="roles__pick" :class="{ 'roles__pick--off': !role.grantable }">
              <input
                type="checkbox"
                :checked="selected.has(role.id)"
                :disabled="!role.grantable"
                @change="toggleRole(role)"
              />
              <span class="roles__name">{{ role.name }}</span>
            </label>
            <p v-if="role.description" class="roles__lede">{{ role.description }}</p>
            <p v-if="!role.grantable" class="roles__blocked">
              Você não pode conceder este papel: ele inclui permissão que você mesma não tem.
            </p>
            <ul class="roles__perms">
              <li v-for="permission in role.permissions" :key="permission.code">
                {{ permission.description }}
              </li>
            </ul>
          </li>
        </ul>

        <div class="panel__more roles__actions">
          <button class="btn" type="button" :disabled="savingRoles" @click="saveRoles">
            {{ savingRoles ? 'Salvando…' : 'Salvar papéis' }}
          </button>
          <button class="btn btn--ghost" type="button" @click="editing = null">Cancelar</button>
          <p v-if="rolesFailure" class="roles__error" role="alert">{{ rolesFailure.message }}</p>
        </div>
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
                  <button
                    v-if="canManage && user.id !== session.user?.id"
                    class="roles__open"
                    type="button"
                    @click="openRoles(user)"
                  >
                    <span v-if="user.roles.length === 0" class="muted">Sem papel</span>
                    <span v-else>{{ user.roles.map((role) => role.name).join(', ') }}</span>
                  </button>
                  <template v-else>
                    <span v-if="user.roles.length === 0" class="muted">Sem papel</span>
                    <span v-else>{{ user.roles.map((role) => role.name).join(', ') }}</span>
                  </template>
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

.roles {
  margin-bottom: var(--space-4);
  border-color: var(--line-strong);
}

.roles__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.roles__item {
  padding: var(--space-4);
  border-bottom: 1px solid var(--line);
}

.roles__item:last-child {
  border-bottom: 0;
}

.roles__pick {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  cursor: pointer;
}

.roles__pick--off {
  cursor: not-allowed;
}

.roles__pick input {
  width: 1.05rem;
  height: 1.05rem;
  accent-color: var(--ink);
  flex: none;
}

.roles__name {
  font-size: var(--step-0);
  font-weight: 650;
  color: var(--text);
}

.roles__pick--off .roles__name {
  color: var(--text-3);
}

.roles__lede {
  font-size: var(--step--1);
  color: var(--text-2);
  margin-top: var(--space-1);
  padding-inline-start: calc(1.05rem + var(--space-3));
  max-width: 68ch;
}

.roles__blocked {
  font-size: var(--step--1);
  color: var(--pendente);
  margin-top: var(--space-2);
  padding-inline-start: calc(1.05rem + var(--space-3));
  max-width: 68ch;
}

/* O que o papel permite, em coluna estreita: é lista para conferir, não para ler corrido. */
.roles__perms {
  margin: var(--space-2) 0 0;
  padding-inline-start: calc(1.05rem + var(--space-3) + 1.1rem);
  columns: 2 22rem;
  column-gap: var(--space-5);
  font-size: 0.82rem;
  color: var(--text-3);
}

.roles__perms li {
  break-inside: avoid;
  margin-bottom: 0.15rem;
}

.roles__actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.roles__error {
  font-size: var(--step--1);
  color: var(--rejeitado);
}

/* A célula de papéis vira alvo de clique sem virar botão visual: o alvo é o texto. */
.roles__open {
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  padding: 0;
  text-align: left;
  cursor: pointer;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 0.22em;
  text-decoration-color: var(--line-strong);
}

.roles__open:hover {
  text-decoration-color: var(--ink);
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
