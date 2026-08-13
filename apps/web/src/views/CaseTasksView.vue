<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { ApiError, request } from '../api/client.js';
import type { CaseSummary, CaseTask, CursorPage } from '../api/types.js';
import StatusChip from '../components/StatusChip.vue';
import {
  formatDueDate,
  isOverdue,
  priorityLabels,
  taskSourceLabels,
  taskStatusLabels,
  taskStatusTone,
} from '../domain/vocabulary.js';

const route = useRoute();
const caseId = String(route.params.id);

const legalCase = ref<CaseSummary | null>(null);
const tasks = ref<CaseTask[]>([]);
const nextCursor = ref<string | null>(null);
const loading = ref(true);
const loadingMore = ref(false);
const failure = ref<ApiError | null>(null);

function toApiError(error: unknown, fallback: string): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError({ statusCode: 0, code: 'UNEXPECTED', message: fallback });
}

const open = computed(() =>
  tasks.value.filter((task) => task.status === 'OPEN' || task.status === 'IN_PROGRESS'),
);
const overdue = computed(() => open.value.filter((task) => isOverdue(task.dueAt, task.status)));

async function load(cursor?: string): Promise<void> {
  const appending = cursor !== undefined;
  if (appending) {
    loadingMore.value = true;
  } else {
    loading.value = true;
    failure.value = null;
  }

  try {
    const [casePayload, page] = await Promise.all([
      appending || legalCase.value !== null
        ? Promise.resolve(legalCase.value)
        : request<CaseSummary>(`/cases/${caseId}`),
      request<CursorPage<CaseTask>>(`/cases/${caseId}/tasks`, {
        query: { limit: 50, ...(cursor === undefined ? {} : { cursor }) },
      }),
    ]);
    if (casePayload !== null) {
      legalCase.value = casePayload;
    }
    tasks.value = appending ? [...tasks.value, ...page.data] : page.data;
    nextCursor.value = page.pageInfo.hasNextPage ? page.pageInfo.nextCursor : null;
  } catch (error) {
    failure.value = toApiError(error, 'Não foi possível carregar as tarefas.');
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
  <section aria-labelledby="tasks-title">
    <p class="crumb">
      <RouterLink :to="{ name: 'cases' }">Casos</RouterLink>
      <span aria-hidden="true">/</span>
      <RouterLink :to="{ name: 'case-detail', params: { id: caseId } }" class="data">
        {{ legalCase?.internalCode ?? 'caso' }}
      </RouterLink>
      <span aria-hidden="true">/</span>
      <span>Tarefas</span>
    </p>

    <header class="head">
      <div>
        <h1 id="tasks-title">Tarefas</h1>
        <p class="muted head__lede">
          O que precisa ser feito neste caso. Tarefas criadas a partir do checklist apontam para a
          exigência que as originou.
        </p>
      </div>
      <RouterLink class="btn btn--ghost" :to="{ name: 'case-checklist', params: { id: caseId } }">
        Abrir checklist
      </RouterLink>
    </header>

    <div v-if="loading" class="panel" aria-busy="true">
      <p class="visually-hidden">Carregando as tarefas.</p>
      <div v-for="row in 4" :key="row" class="skeleton-row">
        <span class="skeleton" style="width: 44%" />
        <span class="skeleton" style="width: 14%" />
      </div>
    </div>

    <div v-else-if="failure" class="state state--error" role="alert">
      <h2 class="state__title">Não foi possível carregar as tarefas</h2>
      <p class="state__body">{{ failure.message }}</p>
      <p v-if="failure.requestId" class="state__ref data">
        Referência para o suporte: {{ failure.requestId }}
      </p>
      <button class="btn" type="button" @click="load()">Tentar novamente</button>
    </div>

    <div v-else-if="tasks.length === 0" class="state">
      <h2 class="state__title">Nenhuma tarefa neste caso</h2>
      <p class="state__body">
        Tarefas nascem das exigências do checklist que ainda faltam. Abra o checklist e crie uma
        tarefa a partir do item pendente — ela fica ligada à exigência de origem.
      </p>
      <RouterLink class="btn" :to="{ name: 'case-checklist', params: { id: caseId } }">
        Abrir checklist
      </RouterLink>
    </div>

    <template v-else>
      <p
        class="verdict"
        :class="overdue.length > 0 ? 'verdict--late' : 'verdict--calm'"
        role="status"
      >
        <template v-if="overdue.length > 0">
          <strong>
            {{ overdue.length }}
            {{ overdue.length === 1 ? 'tarefa atrasada' : 'tarefas atrasadas' }}.
          </strong>
          {{ open.length }} em aberto no total.
        </template>
        <template v-else>
          <strong>Nenhuma tarefa atrasada.</strong>
          {{ open.length }} em aberto.
        </template>
      </p>

      <div class="panel">
        <div class="panel__bar">
          <span class="label">Tarefas</span>
          <span class="data panel__count">{{ tasks.length }} carregadas</span>
        </div>

        <ul class="tasks">
          <li
            v-for="task in tasks"
            :key="task.id"
            class="task"
            :class="{ 'task--late': isOverdue(task.dueAt, task.status) }"
          >
            <div class="task__body">
              <p class="task__title">{{ task.title }}</p>
              <p v-if="task.description" class="task__description">{{ task.description }}</p>
              <p class="task__meta muted">{{ taskSourceLabels[task.sourceType] }}</p>
            </div>

            <div class="task__side">
              <StatusChip
                :label="taskStatusLabels[task.status]"
                :tone="taskStatusTone(task.status)"
              />
              <StatusChip
                v-if="task.priority === 'HIGH' || task.priority === 'URGENT'"
                :label="priorityLabels[task.priority]"
                :tone="task.priority === 'URGENT' ? 'rejeitado' : 'pendente'"
              />
              <span
                v-if="task.dueAt"
                class="task__due data"
                :class="{ 'task__due--late': isOverdue(task.dueAt, task.status) }"
              >
                {{ formatDueDate(task.dueAt) }}
              </span>
            </div>
          </li>
        </ul>

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

      <!-- Limitação honesta: a API expõe listar e criar, não concluir nem reatribuir.
           Dizer isso é melhor que oferecer um botão que não faria nada. -->
      <p class="note">
        A conclusão de tarefa ainda não está disponível nesta tela: a API expõe listagem e criação,
        e a rota que altera o estado de uma tarefa ainda não existe.
      </p>
    </template>
  </section>
</template>

<style scoped>
.crumb {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--step--1);
  color: var(--text-3);
  margin-bottom: var(--space-2);
}

.crumb a {
  color: var(--text-2);
  text-decoration: none;
}

.crumb a:hover {
  color: var(--ink);
}

.head {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

.head__lede {
  font-size: var(--step--1);
  margin-top: var(--space-2);
  max-width: 62ch;
}

.head .btn {
  margin-left: auto;
  flex: none;
}

.verdict {
  font-size: var(--step-0);
  color: var(--text-2);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  border: 1px solid var(--line);
  margin-bottom: var(--space-5);
}

.verdict strong {
  color: var(--text);
  font-weight: 650;
}

.verdict--late {
  background: var(--rejeitado-bg);
  border-color: color-mix(in oklab, var(--rejeitado) 30%, transparent);
}

.verdict--late strong {
  color: var(--rejeitado);
}

.verdict--calm {
  background: var(--surface);
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

.tasks {
  list-style: none;
  margin: 0;
  padding: 0;
}

.task {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3) var(--space-4);
  padding: var(--space-4);
  border-bottom: 1px solid var(--line);
}

.task:last-child {
  border-bottom: 0;
}

/* O atraso se distingue por faixa além do tom, não só por cor. */
.task--late {
  box-shadow: inset 3px 0 0 var(--rejeitado);
}

.task__body {
  min-width: 0;
  flex: 1 1 24rem;
}

.task__title {
  font-size: var(--step-0);
  font-weight: 600;
}

.task__description {
  font-size: var(--step--1);
  color: var(--text-2);
  margin-top: var(--space-1);
  max-width: 62ch;
}

.task__meta {
  font-size: 0.78rem;
  margin-top: var(--space-1);
}

.task__side {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.task__due {
  font-size: 0.82rem;
  color: var(--text-2);
  white-space: nowrap;
}

.task__due--late {
  color: var(--rejeitado);
  font-weight: 600;
}

.note {
  margin-top: var(--space-5);
  border-left: 2px solid var(--line-strong);
  padding-left: var(--space-4);
  font-size: var(--step--1);
  color: var(--text-3);
  max-width: 62ch;
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
  max-width: 56ch;
}

.state__ref {
  font-size: 0.78rem;
  color: var(--text-3);
}

.skeleton-row {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4);
  border-bottom: 1px solid var(--line);
}

.skeleton-row:last-child {
  border-bottom: 0;
}

.skeleton {
  height: 0.7rem;
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
