<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { ApiError, request } from '../api/client.js';
import type { CaseSummary, CursorPage } from '../api/types.js';
import StatusChip from '../components/StatusChip.vue';
import { useSessionStore } from '../stores/session.js';
import {
  caseStatusLabels,
  confidentialityLabels,
  formatDate,
  humanizeCode,
  priorityLabels,
} from '../domain/vocabulary.js';

const cases = ref<CaseSummary[]>([]);
const search = ref('');
/** Termo que produziu a lista atual — o cursor da próxima página tem de usar o mesmo. */
const appliedSearch = ref('');
const session = useSessionStore();
const nextCursor = ref<string | null>(null);
const loading = ref(true);
const loadingMore = ref(false);
const failure = ref<ApiError | null>(null);

async function load(cursor?: string): Promise<void> {
  const appending = cursor !== undefined;
  if (appending) {
    loadingMore.value = true;
  } else {
    loading.value = true;
    failure.value = null;
  }

  try {
    const term = appliedSearch.value;
    const page = await request<CursorPage<CaseSummary>>('/cases', {
      query: {
        limit: 25,
        ...(term.length >= 2 ? { search: term } : {}),
        ...(cursor === undefined ? {} : { cursor }),
      },
    });
    cases.value = appending ? [...cases.value, ...page.data] : page.data;
    nextCursor.value = page.pageInfo.hasNextPage ? page.pageInfo.nextCursor : null;
  } catch (error) {
    if (!appending) {
      cases.value = [];
    }
    failure.value =
      error instanceof ApiError
        ? error
        : new ApiError({
            statusCode: 0,
            code: 'UNEXPECTED',
            message: 'Não foi possível carregar os casos.',
          });
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

/** Submete pelo formulário: busca acontece quando a pessoa manda, não a cada tecla. */
function submitSearch(): void {
  appliedSearch.value = search.value.trim();
  void load();
}

function clearSearch(): void {
  search.value = '';
  appliedSearch.value = '';
  void load();
}

onMounted(() => {
  void load();
});
</script>

<template>
  <section aria-labelledby="cases-title">
    <header class="head">
      <div>
        <h1 id="cases-title">Casos</h1>
        <p class="muted head__lede">Casos do escritório aos quais você tem acesso.</p>
      </div>
      <RouterLink v-if="session.can('cases.create')" class="btn" :to="{ name: 'case-create' }">
        Abrir caso
      </RouterLink>
    </header>

    <!-- O advogado chega com o número do processo colado do e-mail. A busca aceita ele com ou
         sem pontuação, e também o código interno ou parte do título. -->
    <form class="case-search" role="search" @submit.prevent="submitSearch">
      <label class="visually-hidden" for="case-search-input">
        Buscar por número do processo, código interno ou título
      </label>
      <input
        id="case-search-input"
        v-model="search"
        type="search"
        maxlength="120"
        autocomplete="off"
        placeholder="Número do processo, código interno ou título"
      />
      <button class="btn btn--ghost" type="submit">Buscar</button>
      <button v-if="appliedSearch" class="btn btn--ghost" type="button" @click="clearSearch">
        Limpar
      </button>
    </form>

    <!-- Carregando: forma que antecipa o conteúdo, não spinner centralizado. -->
    <div v-if="loading" class="panel" aria-busy="true">
      <p class="visually-hidden">Carregando casos.</p>
      <div v-for="row in 6" :key="row" class="skeleton-row">
        <span class="skeleton" style="width: 18%" />
        <span class="skeleton" style="width: 42%" />
        <span class="skeleton" style="width: 14%" />
        <span class="skeleton" style="width: 10%" />
      </div>
    </div>

    <!-- Erro: o que houve, se é recuperável, e a próxima ação. Nunca detalhe interno. -->
    <div v-else-if="failure" class="state state--error" role="alert">
      <h2 class="state__title">Não foi possível carregar os casos</h2>
      <p class="state__body">{{ failure.message }}</p>
      <p v-if="failure.requestId" class="state__ref data">
        Referência para o suporte: {{ failure.requestId }}
      </p>
      <button class="btn" type="button" @click="load()">Tentar novamente</button>
    </div>

    <!-- Vazio: explica o que apareceria ali e oferece a próxima ação. -->
    <div v-else-if="cases.length === 0 && appliedSearch" class="state">
      <h2 class="state__title">Nenhum caso encontrado</h2>
      <p class="state__body">
        Nada corresponde a <span class="data">{{ appliedSearch }}</span> entre número do processo,
        código interno e título.
      </p>
      <button class="btn" type="button" @click="clearSearch">Ver todos os casos</button>
    </div>

    <div v-else-if="cases.length === 0" class="state">
      <h2 class="state__title">Nenhum caso por aqui ainda</h2>
      <p class="state__body">
        Quando um caso for aberto no escritório, ele aparece nesta lista com situação, prioridade e
        responsável.
      </p>
    </div>

    <div v-else class="panel">
      <div class="panel__bar">
        <span class="label">Casos acessíveis</span>
        <span class="data panel__count">{{ cases.length }} carregados</span>
      </div>

      <div class="scroll-x">
        <table class="rows">
          <caption class="visually-hidden">
            Lista de casos com número do processo, título, situação, prioridade, sigilo, responsável
            e abertura.
          </caption>
          <thead>
            <tr>
              <th scope="col">Processo</th>
              <th scope="col">Caso</th>
              <th scope="col">Situação</th>
              <th scope="col">Prioridade</th>
              <th scope="col">Sigilo</th>
              <th scope="col">Responsável</th>
              <th scope="col" class="right">Aberto em</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in cases" :key="item.id">
              <td class="nowrap">
                <RouterLink
                  class="rows__link data cases__number"
                  :to="{ name: 'case-detail', params: { id: item.id } }"
                >
                  {{ item.cnjNumber ?? item.internalCode }}
                </RouterLink>
                <span class="rows__meta data">
                  {{ item.cnjNumber === null ? 'Sem número de processo' : item.internalCode }}
                </span>
              </td>
              <td>
                <span class="rows__title">{{ item.title }}</span>
                <span class="rows__meta">{{ humanizeCode(item.caseType) }}</span>
              </td>
              <td><StatusChip :label="caseStatusLabels[item.status]" /></td>
              <td>
                <StatusChip
                  :label="priorityLabels[item.priority]"
                  :tone="
                    item.priority === 'URGENT'
                      ? 'rejeitado'
                      : item.priority === 'HIGH'
                        ? 'pendente'
                        : 'neutro'
                  "
                />
              </td>
              <td>
                <StatusChip
                  v-if="item.confidentialityLevel !== 'STANDARD'"
                  :label="confidentialityLabels[item.confidentialityLevel]"
                  tone="sigilo"
                />
                <span v-else class="muted">—</span>
              </td>
              <td :class="{ muted: item.responsible === null }">
                {{ item.responsible?.name ?? 'Sem responsável' }}
              </td>
              <td class="data right nowrap">{{ formatDate(item.openedAt) }}</td>
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
/* Busca: um campo largo e as ações à direita, na mesma linha em telas normais. */
.case-search {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.case-search input {
  flex: 1 1 24rem;
  min-width: 0;
}

.cases__number {
  font-variant-numeric: tabular-nums;
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

.head__lede {
  font-size: var(--step--1);
  margin-top: var(--space-2);
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

.rows__title {
  display: block;
  font-weight: 600;
  color: var(--text);
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

/* Estados vazio e de erro
   ------------------------------------------------------------------------- */

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

/* Esqueleto
   ------------------------------------------------------------------------- */

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
