<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { ApiError, request } from '../api/client.js';
import type { DashboardSummary } from '../api/types.js';
import { formatDateTime } from '../domain/vocabulary.js';
import { useSessionStore } from '../stores/session.js';

const session = useSessionStore();
const summary = ref<DashboardSummary | null>(null);
const loading = ref(true);
const failure = ref<ApiError | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  failure.value = null;
  try {
    summary.value = await request<DashboardSummary>('/dashboard/summary');
  } catch (error) {
    summary.value = null;
    failure.value =
      error instanceof ApiError
        ? error
        : new ApiError({
            statusCode: 0,
            code: 'UNEXPECTED',
            message: 'Não foi possível carregar o painel.',
          });
  } finally {
    loading.value = false;
  }
}

onMounted(() => void load());
</script>

<template>
  <section aria-labelledby="dashboard-title">
    <header class="head">
      <div>
        <p class="label">Visão operacional</p>
        <h1 id="dashboard-title">Painel</h1>
        <p class="muted head__lede">O que exige atenção no acervo que você pode acessar.</p>
      </div>
      <span v-if="summary" class="data muted head__time">
        Atualizado {{ formatDateTime(summary.asOf) }}
      </span>
    </header>

    <div v-if="loading" class="metrics" aria-busy="true">
      <p class="visually-hidden">Carregando o painel.</p>
      <div v-for="item in 4" :key="item" class="metric metric--loading">
        <span class="skeleton" style="width: 48%" />
        <span class="skeleton" style="width: 28%; height: 2rem" />
      </div>
    </div>

    <div v-else-if="failure" class="state state--error" role="alert">
      <h2 class="state__title">Não foi possível carregar o painel</h2>
      <p class="state__body">{{ failure.message }}</p>
      <p v-if="failure.requestId" class="state__ref data">Referência: {{ failure.requestId }}</p>
      <button class="btn" type="button" @click="load">Tentar novamente</button>
    </div>

    <template v-else-if="summary">
      <div class="metrics">
        <article class="metric">
          <p class="label">Casos em aberto</p>
          <p class="metric__value data">{{ summary.cases.open }}</p>
          <p class="metric__detail">
            {{ summary.cases.highPriority }} em prioridade alta · {{ summary.cases.total }} no total
          </p>
          <RouterLink :to="{ name: 'cases' }">Ver casos</RouterLink>
        </article>

        <article class="metric">
          <p class="label">Revisão documental</p>
          <p class="metric__value data">{{ summary.documents.needsReview }}</p>
          <p class="metric__detail">
            {{ summary.documents.processing }} em preparação · {{ summary.documents.failed }} com
            falha
          </p>
          <RouterLink :to="{ name: 'cases' }">Abrir acervo</RouterLink>
        </article>

        <article class="metric" :class="{ 'metric--attention': summary.tasks.overdue > 0 }">
          <p class="label">Tarefas atrasadas</p>
          <p class="metric__value data">{{ summary.tasks.overdue }}</p>
          <p class="metric__detail">{{ summary.tasks.open }} tarefas em aberto</p>
          <RouterLink :to="{ name: 'cases' }">Escolher um caso</RouterLink>
        </article>

        <article class="metric" :class="{ 'metric--attention': summary.processing.failed > 0 }">
          <p class="label">Processamentos ativos</p>
          <p class="metric__value data">{{ summary.processing.active }}</p>
          <p class="metric__detail">
            {{ summary.processing.failed }} com falha ·
            {{ summary.cases.processingLimitReached }} no teto de custo
          </p>
          <RouterLink v-if="session.can('knowledge.search')" :to="{ name: 'search' }">
            Pesquisar acervo
          </RouterLink>
        </article>
      </div>
    </template>
  </section>
</template>

<style scoped>
.head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.head__lede {
  margin-top: var(--space-2);
}

.head__time {
  font-size: var(--step--1);
}

.metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.metric {
  min-height: 13rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-5);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
}

.metric--attention {
  border-left: 3px solid var(--pendente);
}

.metric--loading {
  justify-content: center;
}

.metric__value {
  font-size: var(--step-4);
  line-height: 1;
  color: var(--ink);
}

.metric__detail {
  color: var(--text-2);
}

.metric a {
  margin-top: auto;
  color: var(--ink);
  font-weight: 650;
}

@media (max-width: 48rem) {
  .head {
    align-items: flex-start;
    flex-direction: column;
  }

  .metrics {
    grid-template-columns: 1fr;
  }
}
</style>
