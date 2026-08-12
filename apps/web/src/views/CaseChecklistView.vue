<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { ApiError, request } from '../api/client.js';
import type {
  CaseChecklist,
  CaseChecklistItem,
  CaseSummary,
  ChecklistItemStatus,
  ChecklistTemplate,
  CursorPage,
} from '../api/types.js';
import StatusChip from '../components/StatusChip.vue';
import {
  caseChecklistStatusLabels,
  checklistItemStatusLabels,
  checklistItemTone,
  formatDateTime,
} from '../domain/vocabulary.js';

const route = useRoute();
const caseId = String(route.params.id);

const legalCase = ref<CaseSummary | null>(null);
const checklists = ref<CaseChecklist[]>([]);
const templates = ref<ChecklistTemplate[]>([]);
const loading = ref(true);
const failure = ref<ApiError | null>(null);
const applying = ref(false);
const actionFailure = ref<ApiError | null>(null);
const updating = ref<Set<string>>(new Set());

function toApiError(error: unknown, fallback: string): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError({ statusCode: 0, code: 'UNEXPECTED', message: fallback });
}

/** O que trava o protocolo: exigência obrigatória ainda não recebida. */
const blocking = computed(() =>
  checklists.value.flatMap((checklist) =>
    checklist.items.filter((item) => item.isRequired && item.status === 'MISSING'),
  ),
);

const allItems = computed(() => checklists.value.flatMap((checklist) => checklist.items));
const settled = computed(
  () =>
    allItems.value.filter((item) => item.status === 'VALIDATED' || item.status === 'NOT_APPLICABLE')
      .length,
);

async function load(): Promise<void> {
  loading.value = true;
  failure.value = null;

  try {
    legalCase.value = await request<CaseSummary>(`/cases/${caseId}`);
  } catch (error) {
    failure.value = toApiError(error, 'Não foi possível carregar o caso.');
    loading.value = false;
    return;
  }

  const [checklistPage, templatePage] = await Promise.allSettled([
    request<CursorPage<CaseChecklist>>(`/cases/${caseId}/checklists`, { query: { limit: 25 } }),
    request<CursorPage<ChecklistTemplate>>(`/cases/${caseId}/checklist-templates`, {
      query: { limit: 25 },
    }),
  ]);

  checklists.value = checklistPage.status === 'fulfilled' ? checklistPage.value.data : [];
  templates.value = templatePage.status === 'fulfilled' ? templatePage.value.data : [];
  if (checklistPage.status === 'rejected') {
    failure.value = toApiError(checklistPage.reason, 'Não foi possível carregar o checklist.');
  }
  loading.value = false;
}

async function apply(templateId: string): Promise<void> {
  applying.value = true;
  actionFailure.value = null;
  try {
    const created = await request<CaseChecklist>(`/cases/${caseId}/checklists`, {
      method: 'POST',
      body: { templateId },
    });
    checklists.value = [...checklists.value, created];
  } catch (error) {
    actionFailure.value = toApiError(error, 'Não foi possível aplicar o checklist.');
  } finally {
    applying.value = false;
  }
}

async function updateItem(item: CaseChecklistItem, status: ChecklistItemStatus): Promise<void> {
  if (updating.value.has(item.id) || item.status === status) {
    return;
  }
  updating.value = new Set([...updating.value, item.id]);
  actionFailure.value = null;

  try {
    const updated = await request<CaseChecklistItem>(`/checklist-items/${item.id}`, {
      method: 'PATCH',
      body: { status },
    });
    // Troca pelo retorno do servidor: ele é a autoridade sobre validador e horário.
    checklists.value = checklists.value.map((checklist) => ({
      ...checklist,
      items: checklist.items.map((current) => (current.id === updated.id ? updated : current)),
    }));
  } catch (error) {
    actionFailure.value = toApiError(error, 'Não foi possível atualizar a exigência.');
  } finally {
    const next = new Set(updating.value);
    next.delete(item.id);
    updating.value = next;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <section aria-labelledby="checklist-title">
    <p class="crumb">
      <RouterLink :to="{ name: 'cases' }">Casos</RouterLink>
      <span aria-hidden="true">/</span>
      <RouterLink :to="{ name: 'case-detail', params: { id: caseId } }" class="data">
        {{ legalCase?.internalCode ?? 'caso' }}
      </RouterLink>
      <span aria-hidden="true">/</span>
      <span>Checklist</span>
    </p>

    <header class="head">
      <div>
        <h1 id="checklist-title">Checklist documental</h1>
        <p class="muted head__lede">
          O que ainda falta antes do protocolo. Exigência obrigatória não recebida aparece em
          destaque; o restante é acompanhamento.
        </p>
      </div>
    </header>

    <div v-if="loading" class="panel" aria-busy="true">
      <p class="visually-hidden">Carregando o checklist.</p>
      <div v-for="row in 4" :key="row" class="skeleton-row">
        <span class="skeleton" style="width: 40%" />
        <span class="skeleton" style="width: 16%" />
      </div>
    </div>

    <div v-else-if="failure" class="state state--error" role="alert">
      <h2 class="state__title">Não foi possível carregar o checklist</h2>
      <p class="state__body">{{ failure.message }}</p>
      <p v-if="failure.requestId" class="state__ref data">
        Referência para o suporte: {{ failure.requestId }}
      </p>
      <button class="btn" type="button" @click="load()">Tentar novamente</button>
    </div>

    <template v-else>
      <!-- A resposta à pergunta principal, antes de qualquer lista. -->
      <p
        v-if="checklists.length > 0"
        class="verdict"
        :class="blocking.length === 0 ? 'verdict--clear' : 'verdict--blocked'"
        role="status"
      >
        <template v-if="blocking.length === 0">
          <strong>Nada obrigatório em falta.</strong>
          {{ settled }} de {{ allItems.length }} exigências resolvidas.
        </template>
        <template v-else>
          <strong>
            {{ blocking.length }}
            {{ blocking.length === 1 ? 'exigência obrigatória' : 'exigências obrigatórias' }}
            em falta.
          </strong>
          O protocolo depende {{ blocking.length === 1 ? 'dela' : 'delas' }}.
        </template>
      </p>

      <p v-if="actionFailure" class="action-failure" role="alert">
        {{ actionFailure.message }}
        <span v-if="actionFailure.requestId" class="data action-failure__ref">
          Referência: {{ actionFailure.requestId }}
        </span>
      </p>

      <div v-if="checklists.length === 0" class="state">
        <h2 class="state__title">Nenhum checklist aplicado a este caso</h2>
        <p class="state__body">
          Aplique um modelo para acompanhar o que precisa estar reunido antes do protocolo. O
          checklist vira um instantâneo do modelo: alterações posteriores não mexem neste caso.
        </p>
        <div v-if="templates.length > 0" class="templates">
          <button
            v-for="template in templates"
            :key="template.id"
            class="btn"
            type="button"
            :disabled="applying"
            @click="apply(template.id)"
          >
            {{ applying ? 'Aplicando…' : `Aplicar ${template.name}` }}
          </button>
        </div>
        <p v-else class="muted state__ref">
          Nenhum modelo disponível para a área e o tipo deste caso.
        </p>
      </div>

      <section v-for="checklist in checklists" :key="checklist.id" class="panel">
        <div class="panel__bar">
          <span class="label">
            Exigências
            <span class="data version">· versão {{ checklist.templateVersion }}</span>
          </span>
          <StatusChip
            :label="caseChecklistStatusLabels[checklist.status]"
            :tone="checklist.status === 'COMPLETED' ? 'confirmado' : 'pendente'"
          />
        </div>

        <ul class="items">
          <li
            v-for="item in checklist.items"
            :key="item.id"
            class="item"
            :class="{ 'item--blocking': item.isRequired && item.status === 'MISSING' }"
          >
            <div class="item__body">
              <p class="item__title">
                {{ item.title }}
                <span v-if="item.isRequired" class="item__required">obrigatória</span>
              </p>
              <p v-if="item.description" class="item__description">{{ item.description }}</p>
              <p v-if="item.validatedAt" class="item__stamp data">
                validado em {{ formatDateTime(item.validatedAt) }}
              </p>
            </div>

            <div class="item__review">
              <StatusChip
                :label="checklistItemStatusLabels[item.status]"
                :tone="checklistItemTone(item.status, item.isRequired)"
              />
              <div class="item__actions">
                <button
                  v-if="item.status !== 'VALIDATED'"
                  class="btn btn--sm"
                  type="button"
                  :disabled="updating.has(item.id)"
                  @click="updateItem(item, 'VALIDATED')"
                >
                  {{ updating.has(item.id) ? '…' : 'Validar' }}
                </button>
                <button
                  v-if="item.status !== 'NOT_APPLICABLE'"
                  class="btn btn--ghost btn--sm"
                  type="button"
                  :disabled="updating.has(item.id)"
                  @click="updateItem(item, 'NOT_APPLICABLE')"
                >
                  Não se aplica
                </button>
              </div>
            </div>
          </li>
        </ul>
      </section>
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
  margin-bottom: var(--space-5);
}

.head__lede {
  font-size: var(--step--1);
  margin-top: var(--space-2);
  max-width: 62ch;
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

.verdict--blocked {
  background: var(--rejeitado-bg);
  border-color: color-mix(in oklab, var(--rejeitado) 30%, transparent);
}

.verdict--blocked strong {
  color: var(--rejeitado);
}

.verdict--clear {
  background: var(--confirmado-bg);
  border-color: color-mix(in oklab, var(--confirmado) 28%, transparent);
}

.verdict--clear strong {
  color: var(--confirmado);
}

.action-failure {
  font-size: var(--step--1);
  color: var(--rejeitado);
  background: var(--rejeitado-bg);
  border: 1px solid color-mix(in oklab, var(--rejeitado) 26%, transparent);
  border-radius: var(--radius);
  padding: var(--space-3);
  margin-bottom: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.action-failure__ref {
  font-size: 0.78rem;
  color: var(--text-3);
}

.panel {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  overflow: hidden;
  margin-bottom: var(--space-5);
}

.panel__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: var(--surface-sunk);
  border-bottom: 1px solid var(--line);
}

.version {
  font-size: 0.78rem;
  color: var(--text-3);
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
}

.items {
  list-style: none;
  margin: 0;
  padding: 0;
}

.item {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3) var(--space-4);
  padding: var(--space-4);
  border-bottom: 1px solid var(--line);
}

.item:last-child {
  border-bottom: 0;
}

/* Faixa lateral: a pendência que trava o protocolo se distingue sem depender de cor. */
.item--blocking {
  box-shadow: inset 3px 0 0 var(--rejeitado);
}

.item__body {
  min-width: 0;
  flex: 1 1 22rem;
}

.item__title {
  font-size: var(--step-0);
  font-weight: 600;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-2);
}

.item__required {
  font-size: 0.73rem;
  font-weight: 650;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-3);
}

.item__description {
  font-size: var(--step--1);
  color: var(--text-2);
  margin-top: var(--space-1);
  max-width: 62ch;
}

.item__stamp {
  font-size: 0.78rem;
  color: var(--text-3);
  margin-top: var(--space-1);
}

.item__review {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.item__actions {
  display: flex;
  gap: var(--space-2);
}

.btn--sm {
  font-size: 0.82rem;
  padding: 0.25rem 0.6rem;
}

.templates {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
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
