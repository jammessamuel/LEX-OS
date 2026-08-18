<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { ApiError, request } from '../api/client.js';
import { personTypes, type CursorPage, type Person, type PersonType } from '../api/types.js';
import StatusChip from '../components/StatusChip.vue';
import { formatDate, personTypeLabels } from '../domain/vocabulary.js';
import { useSessionStore } from '../stores/session.js';

const session = useSessionStore();
const persons = ref<Person[]>([]);
const typeFilter = ref<PersonType | ''>('');
const nextCursor = ref<string | null>(null);
const loading = ref(true);
const loadingMore = ref(false);
const failure = ref<ApiError | null>(null);

/** CPF e CNPJ chegam mascarados da API; a tela só escolhe qual dos dois mostrar. */
function documentOf(person: Person): string | null {
  return person.cpf ?? person.cnpj;
}

function contactOf(person: Person): string | null {
  return person.email ?? person.phone;
}

async function load(cursor?: string): Promise<void> {
  const appending = cursor !== undefined;
  if (appending) {
    loadingMore.value = true;
  } else {
    loading.value = true;
    failure.value = null;
  }

  try {
    const page = await request<CursorPage<Person>>('/persons', {
      query: {
        limit: 25,
        ...(typeFilter.value === '' ? {} : { personType: typeFilter.value }),
        ...(cursor === undefined ? {} : { cursor }),
      },
    });
    persons.value = appending ? [...persons.value, ...page.data] : page.data;
    nextCursor.value = page.pageInfo.hasNextPage ? page.pageInfo.nextCursor : null;
  } catch (error) {
    if (!appending) {
      persons.value = [];
    }
    failure.value =
      error instanceof ApiError
        ? error
        : new ApiError({
            statusCode: 0,
            code: 'UNEXPECTED',
            message: 'Não foi possível carregar as pessoas.',
          });
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <section aria-labelledby="persons-title">
    <header class="head">
      <div>
        <h1 id="persons-title">Pessoas</h1>
        <p class="muted head__lede">
          Partes, testemunhas e demais envolvidos cadastrados no escritório.
        </p>
      </div>
      <RouterLink v-if="session.can('persons.manage')" class="btn" :to="{ name: 'person-create' }">
        Cadastrar pessoa
      </RouterLink>
    </header>

    <div class="toolbar">
      <label class="field toolbar__filter">
        <span class="label">Tipo</span>
        <select v-model="typeFilter" :disabled="loading || loadingMore" @change="load()">
          <option value="">Todos</option>
          <option v-for="type in personTypes" :key="type" :value="type">
            {{ personTypeLabels[type] }}
          </option>
        </select>
      </label>
    </div>

    <!-- Carregando: forma que antecipa o conteúdo, não spinner centralizado. -->
    <div v-if="loading" class="panel" aria-busy="true">
      <p class="visually-hidden">Carregando pessoas.</p>
      <div v-for="row in 6" :key="row" class="skeleton-row">
        <span class="skeleton" style="width: 34%" />
        <span class="skeleton" style="width: 14%" />
        <span class="skeleton" style="width: 18%" />
        <span class="skeleton" style="width: 12%" />
      </div>
    </div>

    <!-- Erro: o que houve e a próxima ação. Nunca detalhe interno. -->
    <div v-else-if="failure" class="state state--error" role="alert">
      <h2 class="state__title">Não foi possível carregar as pessoas</h2>
      <p class="state__body">{{ failure.message }}</p>
      <p v-if="failure.requestId" class="state__ref data">
        Referência para o suporte: {{ failure.requestId }}
      </p>
      <button class="btn" type="button" @click="load()">Tentar novamente</button>
    </div>

    <!-- Vazio: explica o que apareceria e oferece a próxima ação. -->
    <div v-else-if="persons.length === 0" class="state">
      <h2 class="state__title">
        {{ typeFilter === '' ? 'Nenhuma pessoa cadastrada' : 'Nada com este tipo' }}
      </h2>
      <p class="state__body">
        Cada pessoa cadastrada pode ser vinculada aos casos como parte, testemunha ou outro papel
        processual, e aparece aqui com documento e contato.
      </p>
      <RouterLink
        v-if="session.can('persons.manage') && typeFilter === ''"
        class="btn"
        :to="{ name: 'person-create' }"
      >
        Cadastrar a primeira pessoa
      </RouterLink>
    </div>

    <div v-else class="panel">
      <div class="panel__bar">
        <span class="label">Pessoas ativas</span>
        <span class="data panel__count">{{ persons.length }} carregadas</span>
      </div>

      <div class="scroll-x">
        <table class="rows">
          <caption class="visually-hidden">
            Lista de pessoas com nome, tipo, documento, contato e data de cadastro.
          </caption>
          <thead>
            <tr>
              <th scope="col">Nome</th>
              <th scope="col">Tipo</th>
              <th scope="col">Documento</th>
              <th scope="col">Contato</th>
              <th scope="col" class="right">Cadastro</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="person in persons" :key="person.id">
              <td>
                <RouterLink
                  class="rows__link"
                  :to="{ name: 'person-detail', params: { id: person.id } }"
                >
                  {{ person.fullName }}
                </RouterLink>
                <span v-if="person.tradeName" class="rows__meta">{{ person.tradeName }}</span>
              </td>
              <td><StatusChip :label="personTypeLabels[person.personType]" /></td>
              <td class="data nowrap" :class="{ muted: documentOf(person) === null }">
                {{ documentOf(person) ?? '—' }}
              </td>
              <td :class="{ muted: contactOf(person) === null }">
                {{ contactOf(person) ?? '—' }}
              </td>
              <td class="data right nowrap">{{ formatDate(person.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="nextCursor" class="panel__more">
        <button
          class="btn btn--ghost"
          type="button"
          :disabled="loadingMore"
          @click="load(nextCursor)"
        >
          {{ loadingMore ? 'Carregando…' : 'Carregar mais' }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.head__lede {
  font-size: var(--step--1);
  margin-top: var(--space-2);
}

.toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-3);
}

.toolbar__filter {
  width: min(14rem, 100%);
}

.toolbar__filter select {
  width: 100%;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius);
  padding: 0.45rem 0.7rem;
  font: inherit;
  font-size: var(--step--1);
}

.panel {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.panel__bar {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: var(--surface-sunk);
  border-bottom: 1px solid var(--line);
}

.panel__count {
  font-size: 0.78rem;
  color: var(--text-3);
}

.panel__more {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--line);
}

.scroll-x {
  overflow-x: auto;
}

.rows {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--step--1);
}

.rows th {
  text-align: left;
  font-size: 0.73rem;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-3);
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
}

.rows td {
  padding: 0.62rem var(--space-4);
  border-bottom: 1px solid var(--line);
  vertical-align: middle;
}

.rows tbody tr:last-child td {
  border-bottom: 0;
}

.rows tbody tr:hover td {
  background: var(--surface-sunk);
}

.rows__link {
  color: var(--ink);
  text-decoration: none;
  font-weight: 600;
}

.rows__link:hover {
  text-decoration: underline;
  text-underline-offset: 0.2em;
}

.rows__meta {
  display: block;
  font-size: 0.78rem;
  color: var(--text-3);
}

.right {
  text-align: right;
}

.nowrap {
  white-space: nowrap;
}

.state {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
}

.state--error {
  border-color: color-mix(in oklab, var(--rejeitado) 34%, var(--line));
}

.state__title {
  font-size: var(--step-1);
}

.state__body {
  color: var(--text-2);
  font-size: var(--step--1);
  max-width: 52ch;
}

.state__ref {
  font-size: 0.78rem;
  color: var(--text-3);
}

.skeleton-row {
  display: flex;
  gap: var(--space-4);
  padding: 0.7rem var(--space-4);
  border-bottom: 1px solid var(--line);
}

.skeleton-row:last-child {
  border-bottom: 0;
}

.skeleton {
  height: 0.6rem;
  border-radius: 2px;
  background: linear-gradient(
    90deg,
    var(--surface-sunk) 0%,
    var(--line) 50%,
    var(--surface-sunk) 100%
  );
  background-size: 220% 100%;
  animation: sweep 1.5s ease-in-out infinite;
}

@keyframes sweep {
  to {
    background-position: -220% 0;
  }
}
</style>
