<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { ApiError, request } from '../api/client.js';
import type { AuditLog, CursorPage } from '../api/types.js';
import { formatDateTime, humanizeCode } from '../domain/vocabulary.js';

const entries = ref<AuditLog[]>([]);
const nextCursor = ref<string | null>(null);
const action = ref('');
const entityType = ref('');
const loading = ref(true);
const loadingMore = ref(false);
const failure = ref<ApiError | null>(null);

async function load(cursor?: string): Promise<void> {
  const appending = cursor !== undefined;
  if (appending) {
    loadingMore.value = true;
  } else {
    loading.value = true;
  }
  if (!appending) failure.value = null;
  try {
    const page = await request<CursorPage<AuditLog>>('/audit-logs', {
      query: {
        limit: 25,
        action: action.value.trim() || undefined,
        entityType: entityType.value.trim() || undefined,
        ...(cursor === undefined ? {} : { cursor }),
      },
    });
    entries.value = appending ? [...entries.value, ...page.data] : page.data;
    nextCursor.value = page.pageInfo.hasNextPage ? page.pageInfo.nextCursor : null;
  } catch (error) {
    if (!appending) entries.value = [];
    failure.value =
      error instanceof ApiError
        ? error
        : new ApiError({
            statusCode: 0,
            code: 'UNEXPECTED',
            message: 'Não foi possível carregar a auditoria.',
          });
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

onMounted(() => void load());
</script>

<template>
  <section aria-labelledby="audit-title">
    <header class="head">
      <div>
        <p class="label">Supervisão</p>
        <h1 id="audit-title">Auditoria</h1>
        <p class="muted head__lede">
          Metadados de ações humanas e automáticas. Conteúdo jurídico e snapshots não aparecem aqui.
        </p>
      </div>
    </header>

    <form class="filters" @submit.prevent="load()">
      <label class="field">
        <span class="label">Ação exata</span>
        <input v-model="action" placeholder="Ex.: task.updated" />
      </label>
      <label class="field">
        <span class="label">Tipo de entidade</span>
        <input v-model="entityType" placeholder="Ex.: task" />
      </label>
      <button class="btn btn--ghost" type="submit" :disabled="loading">Aplicar filtros</button>
    </form>

    <div v-if="loading" class="panel" aria-busy="true">
      <p class="visually-hidden">Carregando a auditoria.</p>
      <div v-for="row in 6" :key="row" class="skeleton-row">
        <span class="skeleton" style="width: 20%" />
        <span class="skeleton" style="width: 32%" />
        <span class="skeleton" style="width: 18%" />
      </div>
    </div>

    <div v-else-if="failure" class="state state--error" role="alert">
      <h2 class="state__title">
        {{
          failure.statusCode === 403 ? 'Acesso reservado à supervisão' : 'Não foi possível carregar'
        }}
      </h2>
      <p class="state__body">
        {{
          failure.statusCode === 403
            ? 'A auditoria exige permissão de supervisão e acesso a casos confidenciais.'
            : failure.message
        }}
      </p>
      <button v-if="failure.statusCode !== 403" class="btn" type="button" @click="load()">
        Tentar novamente
      </button>
    </div>

    <div v-else-if="entries.length === 0" class="state">
      <h2 class="state__title">Nenhum registro para estes filtros</h2>
      <p class="state__body">Altere a ação ou o tipo de entidade e tente novamente.</p>
    </div>

    <div v-else class="panel">
      <div class="scroll-x">
        <table class="rows">
          <caption class="visually-hidden">
            Trilha de auditoria autorizada.
          </caption>
          <thead>
            <tr>
              <th scope="col">Quando</th>
              <th scope="col">Ator</th>
              <th scope="col">Ação</th>
              <th scope="col">Entidade</th>
              <th scope="col">Correlação</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in entries" :key="entry.id">
              <td class="data nowrap">{{ formatDateTime(entry.createdAt) }}</td>
              <td>
                <span>{{ entry.actor?.name ?? humanizeCode(entry.actorType) }}</span>
                <span v-if="entry.actor" class="rows__meta">{{
                  humanizeCode(entry.actorType)
                }}</span>
              </td>
              <td class="data">{{ entry.action }}</td>
              <td>
                {{ humanizeCode(entry.entityType) }}
                <span v-if="entry.entityId" class="rows__meta data">{{ entry.entityId }}</span>
              </td>
              <td class="data muted">{{ entry.correlationId ?? '—' }}</td>
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
  margin-bottom: var(--space-5);
}

.head__lede {
  margin-top: var(--space-2);
  max-width: 72ch;
}

.filters {
  display: grid;
  grid-template-columns: repeat(2, minmax(12rem, 1fr)) auto;
  align-items: end;
  gap: var(--space-3);
  padding: var(--space-4);
  margin-bottom: var(--space-4);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
}

.panel {
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
}

.panel__more {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--line);
}

@media (max-width: 48rem) {
  .filters {
    grid-template-columns: 1fr;
  }
}
</style>
