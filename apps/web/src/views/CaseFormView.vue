<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { cnjSegmentName, isValidCnj, normalizeCnj } from '@lex-os/shared/cnj';

import { ApiError, request } from '../api/client.js';
import {
  caseStatuses,
  confidentialityLevels,
  priorities,
  type AssignableUser,
  type CaseStatus,
  type CaseSummary,
  type ConfidentialityLevel,
  type CursorPage,
  type Priority,
} from '../api/types.js';
import {
  caseStatusLabels,
  confidentialityLabels,
  humanizeCode,
  priorityLabels,
} from '../domain/vocabulary.js';
import { useSessionStore } from '../stores/session.js';

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const caseId = computed(() => (typeof route.params.id === 'string' ? route.params.id : null));
const editing = computed(() => caseId.value !== null);
const canSetBudget = computed(() => session.can('cases.update'));

const form = reactive({
  internalCode: '',
  cnjNumber: '',
  court: '',
  courtDivision: '',
  title: '',
  description: '',
  legalArea: '',
  caseType: '',
  status: 'INTAKE' as CaseStatus,
  priority: 'NORMAL' as Priority,
  confidentialityLevel: 'STANDARD' as ConfidentialityLevel,
  responsibleUserId: '',
  openedAt: new Date().toISOString().slice(0, 10),
  closedAt: '',
  processingCostLimitAmount: '0.00',
});

/**
 * Confere o número enquanto a pessoa digita, mas só depois de ela ter os 20 dígitos.
 *
 * Avisar antes disso seria acusar de erro quem ainda está no meio da digitação. Depois,
 * o aviso vale: o dígito verificador pega justamente a troca de dois números, que é o
 * erro que ninguém percebe relendo.
 */
const cnjCheck = computed<{ state: 'vazio' | 'valido' | 'invalido'; segment: string | null }>(
  () => {
    const value = form.cnjNumber.trim();
    if (value === '') {
      return { state: 'vazio', segment: null };
    }
    const digits = [...value].filter((char) => char >= '0' && char <= '9').length;
    if (digits < 20) {
      return { state: 'vazio', segment: null };
    }
    return isValidCnj(value)
      ? { state: 'valido', segment: cnjSegmentName(value) }
      : { state: 'invalido', segment: null };
  },
);

const responsibleUsers = ref<AssignableUser[]>([]);
const loading = ref(editing.value);
const saving = ref(false);
const failure = ref<ApiError | null>(null);

function apiError(error: unknown, message: string): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError({ statusCode: 0, code: 'UNEXPECTED', message });
}

function toTechnicalCode(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '');
}

function toIsoDate(value: string): string | null {
  return value === '' ? null : `${value}T12:00:00.000Z`;
}

function normalizeCostForComparison(value: string): string {
  const [integer = '0', fraction = ''] = value.replace(',', '.').trim().split('.');
  const normalizedInteger = integer.replace(/^0+(?=\d)/u, '') || '0';
  return `${normalizedInteger}.${fraction.padEnd(6, '0')}`;
}

function fill(current: CaseSummary): void {
  form.internalCode = current.internalCode;
  form.cnjNumber = current.cnjNumber ?? '';
  form.court = current.court ?? '';
  form.courtDivision = current.courtDivision ?? '';
  form.title = current.title;
  form.description = current.description ?? '';
  form.legalArea = humanizeCode(current.legalArea);
  form.caseType = humanizeCode(current.caseType);
  form.status = current.status;
  form.priority = current.priority;
  form.confidentialityLevel = current.confidentialityLevel;
  form.responsibleUserId = current.responsibleUserId ?? '';
  form.openedAt = current.openedAt.slice(0, 10);
  form.closedAt = current.closedAt?.slice(0, 10) ?? '';
  form.processingCostLimitAmount = current.processingCostLimitAmount;
}

async function load(): Promise<void> {
  failure.value = null;
  try {
    const usersPromise = request<CursorPage<AssignableUser>>('/users/assignable', {
      query: { limit: 100 },
    }).catch(() => ({ data: [], pageInfo: { nextCursor: null, hasNextPage: false } }));
    if (caseId.value === null) {
      responsibleUsers.value = (await usersPromise).data;
      return;
    }
    const [current, users] = await Promise.all([
      request<CaseSummary>(`/cases/${caseId.value}`),
      usersPromise,
    ]);
    fill(current);
    responsibleUsers.value = users.data;
  } catch (error) {
    failure.value = apiError(error, 'Não foi possível carregar os dados do caso.');
  } finally {
    loading.value = false;
  }
}

async function save(): Promise<void> {
  saving.value = true;
  failure.value = null;
  try {
    const body = {
      internalCode: form.internalCode.trim(),
      cnjNumber: form.cnjNumber.trim() === '' ? null : normalizeCnj(form.cnjNumber.trim()),
      court: form.court.trim() || null,
      courtDivision: form.courtDivision.trim() || null,
      title: form.title.trim(),
      description: form.description.trim() || null,
      legalArea: toTechnicalCode(form.legalArea),
      caseType: toTechnicalCode(form.caseType),
      status: form.status,
      priority: form.priority,
      confidentialityLevel: form.confidentialityLevel,
      responsibleUserId: form.responsibleUserId || null,
      openedAt: toIsoDate(form.openedAt),
      closedAt: toIsoDate(form.closedAt),
    };
    const saved = await request<CaseSummary>(
      caseId.value === null ? '/cases' : `/cases/${caseId.value}`,
      {
        method: caseId.value === null ? 'POST' : 'PATCH',
        body,
      },
    );

    const normalizedLimit = form.processingCostLimitAmount.replace(',', '.').trim();
    const comparableLimit = normalizeCostForComparison(normalizedLimit);
    if (canSetBudget.value && comparableLimit !== saved.processingCostLimitAmount) {
      await request<CaseSummary>(`/cases/${saved.id}/processing-budget`, {
        method: 'PATCH',
        body: { limitAmount: normalizedLimit },
      });
    }
    await router.replace({ name: 'case-detail', params: { id: saved.id } });
  } catch (error) {
    failure.value = apiError(error, 'Não foi possível salvar o caso.');
  } finally {
    saving.value = false;
  }
}

onMounted(() => void load());
</script>

<template>
  <section aria-labelledby="case-form-title">
    <p class="crumb">
      <RouterLink :to="{ name: 'cases' }">Casos</RouterLink>
      <span aria-hidden="true">/</span>
      <span>{{ editing ? 'Editar' : 'Novo' }}</span>
    </p>

    <header class="head">
      <div>
        <p class="label">Cadastro</p>
        <h1 id="case-form-title">{{ editing ? 'Editar caso' : 'Abrir novo caso' }}</h1>
        <p class="muted">Dados operacionais do caso. Pessoas e documentos são vinculados depois.</p>
      </div>
    </header>

    <div v-if="loading" class="panel form-loading" aria-busy="true">
      <p class="visually-hidden">Carregando o formulário.</p>
      <span v-for="row in 6" :key="row" class="skeleton" />
    </div>

    <form v-else class="panel case-form" @submit.prevent="save">
      <div v-if="failure" class="form-error" role="alert">
        <strong>{{ failure.message }}</strong>
        <span v-if="failure.requestId" class="data">Referência: {{ failure.requestId }}</span>
      </div>

      <div class="form-grid">
        <label class="field">
          <span class="label">Código interno</span>
          <input
            id="case-internal-code"
            v-model="form.internalCode"
            required
            maxlength="80"
            autocomplete="off"
          />
          <span v-if="failure?.detailFor('internalCode')" class="field__error">
            {{ failure.detailFor('internalCode') }}
          </span>
        </label>
        <label class="field field--wide">
          <span class="label">Número do processo</span>
          <input
            id="case-cnj-number"
            v-model="form.cnjNumber"
            class="data"
            maxlength="25"
            inputmode="numeric"
            autocomplete="off"
            placeholder="0001234-27.2026.5.02.0001"
            :aria-invalid="cnjCheck.state === 'invalido'"
          />
          <span v-if="cnjCheck.state === 'invalido'" class="field__error">
            Número inválido. Confira os dígitos — o padrão do CNJ detecta digitação trocada.
          </span>
          <span v-else-if="failure?.detailFor('cnjNumber')" class="field__error">
            {{ failure.detailFor('cnjNumber') }}
          </span>
          <span v-else-if="cnjCheck.segment" class="field__hint">{{ cnjCheck.segment }}</span>
          <span v-else class="field__hint">
            Opcional enquanto o caso não foi protocolado. Pode colar com ou sem pontuação.
          </span>
        </label>
        <label class="field">
          <span class="label">Tribunal</span>
          <input
            id="case-court"
            v-model="form.court"
            maxlength="160"
            autocomplete="off"
            placeholder="Ex.: TRT da 2ª Região"
          />
        </label>
        <label class="field">
          <span class="label">Vara ou órgão julgador</span>
          <input
            id="case-court-division"
            v-model="form.courtDivision"
            maxlength="160"
            autocomplete="off"
            placeholder="Ex.: 1ª Vara do Trabalho de São Paulo"
          />
        </label>
        <label class="field field--wide">
          <span class="label">Título</span>
          <input
            id="case-title-input"
            v-model="form.title"
            required
            minlength="3"
            maxlength="255"
          />
          <span v-if="failure?.detailFor('title')" class="field__error">
            {{ failure.detailFor('title') }}
          </span>
        </label>
        <label class="field">
          <span class="label">Área jurídica</span>
          <input
            id="case-legal-area"
            v-model="form.legalArea"
            required
            placeholder="Ex.: Direito trabalhista"
          />
          <span class="field__hint">Escreva normalmente; o sistema padroniza o cadastro.</span>
        </label>
        <label class="field">
          <span class="label">Tipo de caso</span>
          <input
            id="case-type"
            v-model="form.caseType"
            required
            placeholder="Ex.: Reclamação trabalhista"
          />
        </label>
        <label class="field">
          <span class="label">Situação</span>
          <select v-model="form.status">
            <option v-for="status in caseStatuses" :key="status" :value="status">
              {{ caseStatusLabels[status] }}
            </option>
          </select>
        </label>
        <label class="field">
          <span class="label">Prioridade</span>
          <select v-model="form.priority">
            <option v-for="priority in priorities" :key="priority" :value="priority">
              {{ priorityLabels[priority] }}
            </option>
          </select>
        </label>
        <label class="field">
          <span class="label">Sigilo</span>
          <select v-model="form.confidentialityLevel">
            <option v-for="level in confidentialityLevels" :key="level" :value="level">
              {{ confidentialityLabels[level] }}
            </option>
          </select>
        </label>
        <label class="field">
          <span class="label">Responsável</span>
          <select v-model="form.responsibleUserId">
            <option value="">Sem responsável</option>
            <option v-for="user in responsibleUsers" :key="user.id" :value="user.id">
              {{ user.name }}
            </option>
          </select>
        </label>
        <label class="field">
          <span class="label">Aberto em</span>
          <input v-model="form.openedAt" required type="date" />
        </label>
        <label class="field">
          <span class="label">Encerrado em</span>
          <input v-model="form.closedAt" type="date" />
        </label>
        <label v-if="canSetBudget" class="field">
          <span class="label">Teto de preparo (R$)</span>
          <input
            v-model="form.processingCostLimitAmount"
            required
            inputmode="decimal"
            pattern="[0-9]+([.,][0-9]{1,6})?"
          />
          <span class="field__hint">O processamento para antes de ultrapassar este valor.</span>
        </label>
        <label class="field field--full">
          <span class="label">Descrição</span>
          <textarea v-model="form.description" rows="5" maxlength="20000" />
        </label>
      </div>

      <div class="form-actions">
        <RouterLink
          class="btn btn--ghost"
          :to="caseId ? { name: 'case-detail', params: { id: caseId } } : { name: 'cases' }"
        >
          Cancelar
        </RouterLink>
        <button class="btn" type="submit" :disabled="saving">
          {{ saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Abrir caso' }}
        </button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.crumb {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
  color: var(--text-3);
  font-size: var(--step--1);
}

.crumb a {
  color: var(--text-2);
}

.head {
  margin-bottom: var(--space-5);
}

.head .muted {
  margin-top: var(--space-2);
}

.panel {
  max-width: 64rem;
  padding: var(--space-5);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
}

.form-loading {
  display: grid;
  gap: var(--space-4);
}

.form-loading .skeleton {
  height: 2.5rem;
}

.form-error {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-bottom: var(--space-4);
  padding: var(--space-3);
  border: 1px solid color-mix(in oklab, var(--rejeitado) 35%, var(--line));
  border-radius: var(--radius);
  color: var(--rejeitado);
  background: var(--rejeitado-bg);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.field--wide,
.field--full {
  grid-column: 1 / -1;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-5);
}

@media (max-width: 42rem) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .field--wide,
  .field--full {
    grid-column: auto;
  }
}
</style>
