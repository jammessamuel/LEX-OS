<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { ApiError, request } from '../api/client.js';
import type { CaseSummary, CursorPage, TimelineEvent } from '../api/types.js';
import ProvenanceMark from '../components/ProvenanceMark.vue';
import StatusChip from '../components/StatusChip.vue';
import {
  eventTypeLabel,
  formatConfidence,
  formatDateTime,
  formatEventDate,
  importanceLabels,
} from '../domain/vocabulary.js';

const route = useRoute();
const caseId = String(route.params.id);

const legalCase = ref<CaseSummary | null>(null);
const events = ref<TimelineEvent[]>([]);
const nextCursor = ref<string | null>(null);
const loading = ref(true);
const loadingMore = ref(false);
const failure = ref<ApiError | null>(null);
const confirming = ref<Set<string>>(new Set());
const confirmFailure = ref<ApiError | null>(null);

function toApiError(error: unknown, fallback: string): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError({ statusCode: 0, code: 'UNEXPECTED', message: fallback });
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
    const [casePayload, page] = await Promise.all([
      appending || legalCase.value !== null
        ? Promise.resolve(legalCase.value)
        : request<CaseSummary>(`/cases/${caseId}`),
      request<CursorPage<TimelineEvent>>(`/cases/${caseId}/timeline-events`, {
        query: { limit: 50, ...(cursor === undefined ? {} : { cursor }) },
      }),
    ]);
    if (casePayload !== null) {
      legalCase.value = casePayload;
    }
    events.value = appending ? [...events.value, ...page.data] : page.data;
    nextCursor.value = page.pageInfo.hasNextPage ? page.pageInfo.nextCursor : null;
  } catch (error) {
    failure.value = toApiError(error, 'Não foi possível carregar a cronologia.');
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

async function confirm(event: TimelineEvent): Promise<void> {
  if (confirming.value.has(event.id)) {
    return;
  }
  confirming.value = new Set([...confirming.value, event.id]);
  confirmFailure.value = null;

  try {
    const confirmed = await request<TimelineEvent>(`/timeline-events/${event.id}/confirm`, {
      method: 'POST',
    });
    events.value = events.value.map((item) => (item.id === confirmed.id ? confirmed : item));
  } catch (error) {
    const apiError = toApiError(error, 'Não foi possível confirmar o evento.');
    // Outra pessoa confirmou primeiro: a lista é recarregada para mostrar o estado real,
    // em vez de exibir um erro para algo que, na prática, deu certo.
    if (apiError.code === 'TIMELINE_EVENT_ALREADY_CONFIRMED') {
      await load();
    } else {
      confirmFailure.value = apiError;
    }
  } finally {
    const next = new Set(confirming.value);
    next.delete(event.id);
    confirming.value = next;
  }
}

function sourceLines(event: TimelineEvent): string[] {
  const lines: string[] = [];
  if (event.extraction) {
    lines.push(`${event.extraction.provider} · ${event.extraction.modelName}`);
  }
  lines.push(`confiança ${formatConfidence(event.confidenceScore)}`);
  const page = event.sourceLocator?.pageNumber;
  if (typeof page === 'number') {
    lines.push(`página ${page}`);
  }
  return lines;
}

onMounted(() => {
  void load();
});
</script>

<template>
  <section aria-labelledby="timeline-title">
    <p class="crumb">
      <RouterLink :to="{ name: 'cases' }">Casos</RouterLink>
      <span aria-hidden="true">/</span>
      <RouterLink :to="{ name: 'case-detail', params: { id: caseId } }" class="data">
        {{ legalCase?.internalCode ?? 'caso' }}
      </RouterLink>
      <span aria-hidden="true">/</span>
      <span>Cronologia</span>
    </p>

    <header class="head">
      <div>
        <h1 id="timeline-title">Cronologia</h1>
        <p class="muted head__lede">
          Eventos identificados nos documentos, na ordem dos fatos. Cada um carrega a origem; a
          confirmação registra quem validou e preserva a extração original.
        </p>
      </div>
    </header>

    <div v-if="loading" class="panel" aria-busy="true">
      <p class="visually-hidden">Carregando a cronologia.</p>
      <div v-for="row in 4" :key="row" class="skeleton-row">
        <span class="skeleton" style="width: 7rem" />
        <span class="skeleton" style="width: 46%" />
        <span class="skeleton" style="width: 12%" />
      </div>
    </div>

    <div v-else-if="failure" class="state state--error" role="alert">
      <h2 class="state__title">Não foi possível carregar a cronologia</h2>
      <p class="state__body">{{ failure.message }}</p>
      <p v-if="failure.requestId" class="state__ref data">
        Referência para o suporte: {{ failure.requestId }}
      </p>
      <button class="btn" type="button" @click="load()">Tentar novamente</button>
    </div>

    <div v-else-if="events.length === 0" class="state">
      <h2 class="state__title">Nenhum evento identificado ainda</h2>
      <p class="state__body">
        A cronologia é montada durante a preparação dos documentos. Envie os arquivos do caso e os
        fatos com data aparecem aqui, cada um apontando para sua origem.
      </p>
    </div>

    <div v-else class="panel">
      <div class="panel__bar">
        <span class="label">Eventos</span>
        <span class="data panel__count">
          {{ events.filter((item) => !item.confirmedByUser).length }} aguardando revisão
        </span>
      </div>

      <p v-if="confirmFailure" class="confirm-failure" role="alert">
        {{ confirmFailure.message }}
        <span v-if="confirmFailure.requestId" class="data confirm-failure__ref">
          Referência: {{ confirmFailure.requestId }}
        </span>
      </p>

      <ol class="events">
        <li v-for="(event, position) in events" :key="event.id" class="event">
          <div class="event__when">
            <span class="event__date data">
              {{ formatEventDate(event.occurredAt, event.datePrecision) }}
            </span>
            <StatusChip
              v-if="event.importance === 'HIGH' || event.importance === 'CRITICAL'"
              :label="importanceLabels[event.importance]"
              tone="pendente"
            />
          </div>

          <div class="event__body">
            <p class="event__title">
              <ProvenanceMark
                v-if="!event.confirmedByUser && event.createdByActorType === 'AI'"
                :value="event.title"
                :index="position + 1"
                :source-lines="sourceLines(event)"
              />
              <strong v-else>{{ event.title }}</strong>
            </p>
            <p class="event__description">{{ event.description }}</p>
            <p class="event__meta muted">{{ eventTypeLabel(event.eventType) }}</p>
          </div>

          <div class="event__review">
            <template v-if="event.confirmedByUser">
              <StatusChip label="Confirmado" tone="confirmado" />
              <span v-if="event.confirmedAt" class="event__stamp data">
                em {{ formatDateTime(event.confirmedAt) }}
              </span>
            </template>
            <template v-else>
              <StatusChip label="Aguardando revisão" tone="pendente" />
              <button
                class="btn btn--sm"
                type="button"
                :disabled="confirming.has(event.id)"
                @click="confirm(event)"
              >
                {{ confirming.has(event.id) ? 'Confirmando…' : 'Confirmar' }}
              </button>
            </template>
          </div>
        </li>
      </ol>

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
  margin-bottom: var(--space-5);
}

.head__lede {
  font-size: var(--step--1);
  margin-top: var(--space-2);
  max-width: 62ch;
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

.confirm-failure {
  margin: var(--space-3) var(--space-4) 0;
  font-size: var(--step--1);
  color: var(--rejeitado);
  background: var(--rejeitado-bg);
  border: 1px solid color-mix(in oklab, var(--rejeitado) 26%, transparent);
  border-radius: var(--radius);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.confirm-failure__ref {
  font-size: 0.78rem;
  color: var(--text-3);
}

.events {
  list-style: none;
  margin: 0;
  padding: 0;
}

.event {
  display: grid;
  grid-template-columns: 11rem minmax(0, 1fr) auto;
  gap: var(--space-2) var(--space-4);
  padding: var(--space-4);
  border-bottom: 1px solid var(--line);
  align-items: start;
}

.event:last-child {
  border-bottom: 0;
}

@media (max-width: 52rem) {
  .event {
    grid-template-columns: 1fr;
  }
}

.event__when {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
}

.event__date {
  font-size: var(--step--1);
  color: var(--text-2);
  white-space: nowrap;
}

.event__title {
  font-size: var(--step-0);
}

.event__title strong {
  font-weight: 650;
}

.event__description {
  font-size: var(--step--1);
  color: var(--text-2);
  max-width: 62ch;
  margin-top: var(--space-1);
}

.event__meta {
  font-size: 0.78rem;
  margin-top: var(--space-1);
}

.event__review {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-2);
}

@media (max-width: 52rem) {
  .event__review {
    flex-direction: row;
    align-items: center;
  }
}

.event__stamp {
  font-size: 0.78rem;
  color: var(--text-3);
}

.btn--sm {
  font-size: 0.82rem;
  padding: 0.25rem 0.6rem;
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
