<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ApiError, request, type NoContent } from '../api/client.js';
import type {
  CaseDocument,
  CaseExport,
  CaseSummary,
  CursorPage,
  Participant,
} from '../api/types.js';
import FileIntakePanel from '../components/FileIntakePanel.vue';
import PreparationStatus from '../components/PreparationStatus.vue';
import ParticipantForm from '../components/ParticipantForm.vue';
import StatusChip from '../components/StatusChip.vue';
import { useSessionStore } from '../stores/session.js';
import {
  caseStatusLabels,
  confidentialityLabels,
  documentSituation,
  formatBytes,
  formatDate,
  humanizeCode,
  participantRoleLabels,
  participantSideLabels,
  priorityLabels,
} from '../domain/vocabulary.js';

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const caseId = String(route.params.id);

const legalCase = ref<CaseSummary | null>(null);

/** Tribunal e vara numa linha só, sem separador solto quando um dos dois não foi informado. */
const courtLine = computed(() =>
  [legalCase.value?.court, legalCase.value?.courtDivision].filter(Boolean).join(' · '),
);
const documents = ref<CaseDocument[]>([]);
const participants = ref<Participant[]>([]);
const documentsNextCursor = ref<string | null>(null);
const participantsNextCursor = ref<string | null>(null);
const loading = ref(true);
const loadingMoreDocuments = ref(false);
const loadingMoreParticipants = ref(false);
const failure = ref<ApiError | null>(null);
const documentsFailure = ref<ApiError | null>(null);
const participantsFailure = ref<ApiError | null>(null);
const documentsMoreFailure = ref<ApiError | null>(null);
const participantsMoreFailure = ref<ApiError | null>(null);
const addingParticipant = ref(false);
const removing = ref(false);

function toApiError(error: unknown, fallback: string): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError({ statusCode: 0, code: 'UNEXPECTED', message: fallback });
}

async function load(): Promise<void> {
  loading.value = true;
  failure.value = null;
  legalCase.value = null;
  documents.value = [];
  participants.value = [];
  documentsNextCursor.value = null;
  participantsNextCursor.value = null;
  documentsFailure.value = null;
  participantsFailure.value = null;
  documentsMoreFailure.value = null;
  participantsMoreFailure.value = null;

  try {
    legalCase.value = await request<CaseSummary>(`/cases/${caseId}`);
  } catch (error) {
    failure.value = toApiError(error, 'Não foi possível carregar o caso.');
    loading.value = false;
    return;
  }

  // Os painéis carregam em paralelo e tratam suas falhas sem esconder os dados do caso.
  await Promise.all([
    ...(session.can('documents.read') ? [loadDocuments()] : []),
    loadParticipants(),
  ]);
  loading.value = false;
}

async function loadDocuments(cursor?: string): Promise<void> {
  const appending = cursor !== undefined;
  if (appending) {
    loadingMoreDocuments.value = true;
    documentsMoreFailure.value = null;
  } else {
    documentsFailure.value = null;
  }

  try {
    const page = await request<CursorPage<CaseDocument>>(`/cases/${caseId}/documents`, {
      query: { limit: 25, ...(cursor === undefined ? {} : { cursor }) },
    });
    documents.value = appending ? [...documents.value, ...page.data] : page.data;
    documentsNextCursor.value = page.pageInfo.hasNextPage ? page.pageInfo.nextCursor : null;
  } catch (error) {
    const apiError = toApiError(error, 'Não foi possível carregar os documentos.');
    if (appending) {
      documentsMoreFailure.value = apiError;
    } else {
      documentsFailure.value = apiError;
    }
  } finally {
    loadingMoreDocuments.value = false;
  }
}

async function loadParticipants(cursor?: string): Promise<void> {
  const appending = cursor !== undefined;
  if (appending) {
    loadingMoreParticipants.value = true;
    participantsMoreFailure.value = null;
  } else {
    participantsFailure.value = null;
  }

  try {
    const page = await request<CursorPage<Participant>>(`/cases/${caseId}/participants`, {
      query: { limit: 25, ...(cursor === undefined ? {} : { cursor }) },
    });
    participants.value = appending ? [...participants.value, ...page.data] : page.data;
    participantsNextCursor.value = page.pageInfo.hasNextPage ? page.pageInfo.nextCursor : null;
  } catch (error) {
    const apiError = toApiError(error, 'Não foi possível carregar as partes.');
    if (appending) {
      participantsMoreFailure.value = apiError;
    } else {
      participantsFailure.value = apiError;
    }
  } finally {
    loadingMoreParticipants.value = false;
  }
}

/** Depois de um envio, os aceitos já têm documento criado; a primeira página é recarregada. */
async function refreshDocuments(): Promise<void> {
  await loadDocuments();
}

const preparation = ref<InstanceType<typeof PreparationStatus> | null>(null);
const activeStages = ref<ReadonlyMap<string, string>>(new Map());

function onStages(byDocument: ReadonlyMap<string, string>): void {
  activeStages.value = byDocument;
}

/**
 * A situação exibida combina a lista de documentos com a etapa ativa do preparo: enquanto
 * o servidor trabalha, o chip diz o verbo da etapa ("Extraindo texto…") em vez do estado
 * frio do documento. A posição das linhas nunca muda durante o polling.
 */
function situationFor(document: CaseDocument): {
  label: string;
  tone: 'neutro' | 'pendente' | 'confirmado' | 'rejeitado';
} {
  const stage = activeStages.value.get(document.id);
  if (stage !== undefined) {
    return { label: `${stage}…`, tone: 'pendente' };
  }
  return documentSituation(document);
}

function onIntakeFinished(): void {
  if (session.can('documents.read')) {
    void refreshDocuments();
    preparation.value?.wake();
  }
}

function onParticipantCreated(participant: Participant): void {
  participants.value = [participant, ...participants.value];
  addingParticipant.value = false;
}

const underLegalHold = computed(() => legalCase.value?.legalHoldAt != null);
const holdReason = ref('');
const changingHold = ref(false);
const holdFormOpen = ref(false);

/**
 * Põe ou retira a retenção obrigatória.
 *
 * O motivo é exigido nos dois sentidos: quem libera um caso retido responde por isso, e a
 * auditoria sem o porquê não explica nada a quem for olhar depois.
 */
async function toggleLegalHold(hold: boolean): Promise<void> {
  changingHold.value = true;
  failure.value = null;
  try {
    legalCase.value = await request<CaseSummary>(`/cases/${caseId}/legal-hold`, {
      method: 'PUT',
      body: { hold, reason: holdReason.value },
    });
    holdFormOpen.value = false;
    holdReason.value = '';
  } catch (error) {
    failure.value = toApiError(error, 'Não foi possível alterar a retenção do caso.');
  } finally {
    changingHold.value = false;
  }
}

async function removeCase(): Promise<void> {
  if (
    !window.confirm(
      'Excluir este caso? Documentos e histórico permanecerão protegidos para auditoria.',
    )
  ) {
    return;
  }
  removing.value = true;
  failure.value = null;
  try {
    await request<NoContent>(`/cases/${caseId}`, { method: 'DELETE' });
    await router.replace({ name: 'cases' });
  } catch (error) {
    failure.value = toApiError(error, 'Não foi possível excluir o caso.');
  } finally {
    removing.value = false;
  }
}

/**
 * Exportação do dossiê: pedir, acompanhar, baixar.
 *
 * O documento é montado pelo worker, então a tela pergunta de tempos em tempos e para de
 * perguntar quando termina — ou quando falha. Um polling que nunca desiste transforma uma
 * falha silenciosa numa aba que consome bateria a tarde inteira.
 */
const exportJob = ref<CaseExport | null>(null);
const exporting = ref(false);
const exportFailure = ref<string | null>(null);
let exportTimer: ReturnType<typeof setTimeout> | undefined;
const EXPORT_POLL_MS = 1_500;
const EXPORT_MAX_POLLS = 60;
let exportPolls = 0;

async function requestExport(): Promise<void> {
  if (exporting.value) {
    return;
  }
  exporting.value = true;
  exportFailure.value = null;
  exportPolls = 0;
  try {
    exportJob.value = await request<CaseExport>(`/cases/${caseId}/exports`, { method: 'POST' });
    scheduleExportPoll();
  } catch (error) {
    exporting.value = false;
    exportFailure.value = toApiError(error, 'Não foi possível pedir o dossiê.').message;
  }
}

function scheduleExportPoll(): void {
  const job = exportJob.value;
  if (job === null || job.status === 'COMPLETED' || job.status === 'FAILED') {
    exporting.value = false;
    return;
  }
  if (exportPolls >= EXPORT_MAX_POLLS) {
    exporting.value = false;
    exportFailure.value =
      'O dossiê está demorando mais do que o normal. Tente novamente em alguns minutos.';
    return;
  }
  exportPolls += 1;
  exportTimer = setTimeout(() => void pollExport(), EXPORT_POLL_MS);
}

async function pollExport(): Promise<void> {
  const job = exportJob.value;
  if (job === null) {
    return;
  }
  try {
    exportJob.value = await request<CaseExport>(`/case-exports/${job.id}`);
    if (exportJob.value.status === 'FAILED') {
      exporting.value = false;
      exportFailure.value = 'Não foi possível montar o dossiê. Tente novamente.';
      return;
    }
    scheduleExportPoll();
  } catch (error) {
    exporting.value = false;
    exportFailure.value = toApiError(error, 'Não foi possível acompanhar o dossiê.').message;
  }
}

onUnmounted(() => {
  if (exportTimer !== undefined) {
    clearTimeout(exportTimer);
  }
});

onMounted(() => {
  void load();
});
</script>

<template>
  <section aria-labelledby="case-title">
    <p class="crumb">
      <RouterLink :to="{ name: 'cases' }">Casos</RouterLink>
      <span aria-hidden="true">/</span>
      <span class="data">{{ legalCase?.internalCode ?? '…' }}</span>
    </p>

    <div v-if="loading" class="skeleton-head" aria-busy="true">
      <p class="visually-hidden">Carregando o caso.</p>
      <span class="skeleton" style="width: 22rem; height: 1.9rem" />
      <span class="skeleton" style="width: 14rem" />
    </div>

    <div v-else-if="failure" class="state state--error" role="alert">
      <h2 class="state__title">Não foi possível abrir este caso</h2>
      <p class="state__body">{{ failure.message }}</p>
      <p v-if="failure.requestId" class="state__ref data">
        Referência para o suporte: {{ failure.requestId }}
      </p>
      <button class="btn" type="button" @click="load()">Tentar novamente</button>
    </div>

    <template v-else-if="legalCase">
      <header class="head">
        <div>
          <!-- O número do processo vem antes do título: é por ele que o advogado reconhece
               o caso, e é o que ele confere ao abrir a tela. -->
          <p v-if="legalCase.cnjNumber" class="case-process">
            <span class="data case-process__number">{{ legalCase.cnjNumber }}</span>
            <span v-if="courtLine" class="muted case-process__court">{{ courtLine }}</span>
          </p>
          <p v-else class="muted case-process case-process--pending">Sem número de processo</p>
          <h1 id="case-title">{{ legalCase.title }}</h1>
          <div class="head__meta">
            <StatusChip v-if="underLegalHold" label="Sob retenção obrigatória" tone="rejeitado" />
            <StatusChip :label="caseStatusLabels[legalCase.status]" />
            <StatusChip
              :label="priorityLabels[legalCase.priority]"
              :tone="
                legalCase.priority === 'URGENT'
                  ? 'rejeitado'
                  : legalCase.priority === 'HIGH'
                    ? 'pendente'
                    : 'neutro'
              "
            />
            <StatusChip
              v-if="legalCase.confidentialityLevel !== 'STANDARD'"
              :label="confidentialityLabels[legalCase.confidentialityLevel]"
              tone="sigilo"
            />
            <span class="muted head__code data">
              {{ legalCase.internalCode }} · {{ humanizeCode(legalCase.caseType) }}
            </span>
          </div>
        </div>
        <div class="head__actions">
          <RouterLink
            class="btn btn--ghost"
            :to="{ name: 'case-timeline', params: { id: caseId } }"
          >
            Cronologia
          </RouterLink>
          <RouterLink
            class="btn btn--ghost"
            :to="{ name: 'case-checklist', params: { id: caseId } }"
          >
            Checklist
          </RouterLink>
          <RouterLink
            v-if="session.can('tasks.read')"
            class="btn btn--ghost"
            :to="{ name: 'case-tasks', params: { id: caseId } }"
          >
            Tarefas
          </RouterLink>
          <a
            v-if="exportJob?.status === 'COMPLETED' && exportJob.downloadUrl"
            class="btn"
            :href="exportJob.downloadUrl"
            target="_blank"
            rel="noopener"
          >
            Baixar dossiê
          </a>
          <button
            v-else
            class="btn btn--ghost"
            type="button"
            :disabled="exporting"
            @click="requestExport"
          >
            {{ exporting ? 'Montando dossiê…' : 'Exportar dossiê' }}
          </button>
          <RouterLink
            v-if="session.can('cases.update')"
            class="btn btn--ghost"
            :to="{ name: 'case-edit', params: { id: caseId } }"
          >
            Editar caso
          </RouterLink>
          <button
            v-if="session.can('cases.legal_hold') && !holdFormOpen"
            class="btn"
            type="button"
            :disabled="changingHold"
            @click="holdFormOpen = true"
          >
            {{ underLegalHold ? 'Retirar retenção' : 'Reter caso' }}
          </button>
          <!--
            O botão continua à vista sob retenção, desabilitado e com o motivo no title. Sumir
            com ele não explicaria nada: quem procura por que não consegue excluir precisa
            encontrar o botão e a razão no mesmo lugar.
          -->
          <button
            v-if="session.can('cases.delete')"
            class="btn btn--danger"
            type="button"
            :disabled="removing || underLegalHold"
            :title="
              underLegalHold
                ? 'O caso está sob retenção obrigatória. Retire a retenção antes de excluir.'
                : undefined
            "
            @click="removeCase"
          >
            {{ removing ? 'Excluindo…' : 'Excluir caso' }}
          </button>
        </div>
      </header>

      <div v-if="underLegalHold" class="hold" role="note">
        <p class="hold__titulo">Este caso está sob retenção obrigatória.</p>
        <p class="hold__motivo">{{ legalCase.legalHoldReason }}</p>
        <p class="hold__efeito">
          Enquanto a retenção estiver posta, nem o caso nem seus documentos e pessoas podem ser
          excluídos por ninguém, inclusive por quem administra a organização.
        </p>
      </div>

      <form
        v-if="holdFormOpen"
        class="hold-form"
        @submit.prevent="toggleLegalHold(!underLegalHold)"
      >
        <label class="label" for="hold-reason">
          {{ underLegalHold ? 'Motivo da liberação' : 'Motivo da retenção' }}
        </label>
        <input
          id="hold-reason"
          v-model="holdReason"
          type="text"
          maxlength="500"
          required
          :placeholder="
            underLegalHold
              ? 'Ex.: decisão que determinou a guarda foi cumprida em 12/08.'
              : 'Ex.: ordem judicial de preservação no processo 0009999-84.2026.5.02.0001.'
          "
        />
        <div class="hold-form__acoes">
          <button
            class="btn"
            type="submit"
            :disabled="changingHold || holdReason.trim().length < 3"
          >
            {{ changingHold ? 'Registrando…' : underLegalHold ? 'Retirar retenção' : 'Reter caso' }}
          </button>
          <button
            class="btn btn--ghost"
            type="button"
            :disabled="changingHold"
            @click="holdFormOpen = false"
          >
            Cancelar
          </button>
        </div>
      </form>

      <p v-if="exportFailure" class="note note--alert" role="alert">{{ exportFailure }}</p>

      <div class="split">
        <div class="stack">
          <FileIntakePanel
            v-if="session.can('documents.upload')"
            :case-id="caseId"
            @finished="onIntakeFinished"
          />

          <PreparationStatus
            v-if="session.can('documents.read')"
            ref="preparation"
            :case-id="caseId"
            @stages="onStages"
            @settled="refreshDocuments"
          />

          <section v-if="session.can('documents.read')" class="panel">
            <div class="panel__bar">
              <span class="label">Documentos</span>
              <span class="data panel__count">{{ documents.length }} carregados</span>
            </div>

            <div
              v-if="documentsFailure"
              class="panel-failure"
              role="alert"
              data-test="documents-failure"
            >
              <p class="panel-failure__title">
                {{
                  documents.length === 0
                    ? 'Não foi possível carregar os documentos'
                    : 'A lista de documentos pode estar desatualizada'
                }}
              </p>
              <p>{{ documentsFailure.message }}</p>
              <p v-if="documentsFailure.requestId" class="data panel-failure__ref">
                Referência: {{ documentsFailure.requestId }}
              </p>
              <button class="btn btn--ghost" type="button" @click="loadDocuments()">
                Tentar novamente
              </button>
            </div>

            <div v-if="documents.length === 0 && !documentsFailure" class="empty">
              <p class="empty__t">Nenhum documento neste caso</p>
              <p class="empty__b">
                Envie os arquivos que o cliente mandou. O LEX OS valida, extrai o texto e identifica
                as partes antes de você abrir o primeiro documento.
              </p>
            </div>

            <div v-if="documents.length > 0" class="scroll-x">
              <table class="rows">
                <caption class="visually-hidden">
                  Documentos do caso com tipo, situação e tamanho.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Documento</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Situação</th>
                    <th scope="col" class="right">Tamanho</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in documents" :key="item.id">
                    <td>
                      <RouterLink
                        class="rows__title rows__title--link"
                        :to="{ name: 'document-detail', params: { id: item.id } }"
                      >
                        {{ item.title }}
                      </RouterLink>
                      <span class="rows__meta data">{{ item.file.filename }}</span>
                    </td>
                    <td class="muted">{{ item.documentType?.name ?? 'Não classificado' }}</td>
                    <td>
                      <StatusChip
                        :label="situationFor(item).label"
                        :tone="situationFor(item).tone"
                      />
                    </td>
                    <td class="data right nowrap">{{ formatBytes(item.file.sizeBytes) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-if="documentsMoreFailure" class="panel-more-error" role="alert">
              <span>{{ documentsMoreFailure.message }}</span>
              <button
                v-if="documentsNextCursor"
                class="btn btn--ghost"
                type="button"
                @click="loadDocuments(documentsNextCursor)"
              >
                Tentar novamente
              </button>
            </div>

            <div v-else-if="documentsNextCursor" class="panel__more">
              <button
                class="btn btn--ghost"
                type="button"
                :disabled="loadingMoreDocuments"
                @click="loadDocuments(documentsNextCursor)"
              >
                {{ loadingMoreDocuments ? 'Carregando…' : 'Carregar mais documentos' }}
              </button>
            </div>
          </section>
        </div>

        <div class="stack">
          <section class="panel">
            <div class="panel__bar">
              <span class="label">Partes</span>
              <div class="panel__bar-actions">
                <span class="data panel__count">{{ participants.length }} carregadas</span>
                <button
                  v-if="session.can('cases.update') && session.can('persons.read')"
                  class="text-button"
                  type="button"
                  @click="addingParticipant = !addingParticipant"
                >
                  {{ addingParticipant ? 'Fechar' : 'Adicionar parte' }}
                </button>
              </div>
            </div>

            <ParticipantForm
              v-if="addingParticipant"
              :case-id="caseId"
              @created="onParticipantCreated"
              @cancel="addingParticipant = false"
            />

            <div
              v-if="participantsFailure"
              class="panel-failure"
              role="alert"
              data-test="participants-failure"
            >
              <p class="panel-failure__title">
                {{
                  participants.length === 0
                    ? 'Não foi possível carregar as partes'
                    : 'A lista de partes pode estar desatualizada'
                }}
              </p>
              <p>{{ participantsFailure.message }}</p>
              <p v-if="participantsFailure.requestId" class="data panel-failure__ref">
                Referência: {{ participantsFailure.requestId }}
              </p>
              <button class="btn btn--ghost" type="button" @click="loadParticipants()">
                Tentar novamente
              </button>
            </div>

            <div v-if="participants.length === 0 && !participantsFailure" class="empty">
              <p class="empty__b">Nenhuma parte associada a este caso ainda.</p>
            </div>

            <ul v-if="participants.length > 0" class="parts">
              <li v-for="part in participants" :key="part.id" class="part">
                <span class="part__name">
                  {{ part.person.tradeName ?? part.person.fullName }}
                </span>
                <span class="part__meta">
                  {{ participantRoleLabels[part.role] }}
                  <template v-if="part.side">· {{ participantSideLabels[part.side] }}</template>
                </span>
                <StatusChip v-if="part.isClient" label="Cliente" tone="confirmado" />
              </li>
            </ul>

            <div v-if="participantsMoreFailure" class="panel-more-error" role="alert">
              <span>{{ participantsMoreFailure.message }}</span>
              <button
                v-if="participantsNextCursor"
                class="btn btn--ghost"
                type="button"
                @click="loadParticipants(participantsNextCursor)"
              >
                Tentar novamente
              </button>
            </div>

            <div v-else-if="participantsNextCursor" class="panel__more">
              <button
                class="btn btn--ghost"
                type="button"
                :disabled="loadingMoreParticipants"
                @click="loadParticipants(participantsNextCursor)"
              >
                {{ loadingMoreParticipants ? 'Carregando…' : 'Carregar mais partes' }}
              </button>
            </div>
          </section>

          <section class="panel">
            <div class="panel__bar"><span class="label">Dados do caso</span></div>
            <dl class="facts">
              <dt>Área</dt>
              <dd>{{ humanizeCode(legalCase.legalArea) }}</dd>
              <dt>Aberto em</dt>
              <dd class="data">{{ formatDate(legalCase.openedAt) }}</dd>
              <dt v-if="legalCase.closedAt">Encerrado em</dt>
              <dd v-if="legalCase.closedAt" class="data">{{ formatDate(legalCase.closedAt) }}</dd>
              <dt>Responsável</dt>
              <dd :class="{ muted: legalCase.responsible === null }">
                {{ legalCase.responsible?.name ?? 'Sem responsável' }}
              </dd>
            </dl>
          </section>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.hold {
  padding: var(--space-3) var(--space-4);
  margin-bottom: var(--space-4);
  background: var(--surface-sunk);
  border: 1px solid var(--line);
  border-left: 3px solid var(--danger, #b3261e);
  border-radius: var(--radius);
}

.hold__titulo {
  margin: 0 0 var(--space-2);
  font-weight: 600;
}

.hold__motivo {
  margin: 0 0 var(--space-2);
  color: var(--text-2);
}

.hold__efeito {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-3);
  line-height: 1.5;
}

.hold-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  margin-bottom: var(--space-4);
  background: var(--surface-sunk);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}

.hold-form__acoes {
  display: flex;
  gap: var(--space-2);
}

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
  gap: var(--space-5);
  margin-bottom: var(--space-6);
}

.head__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-4);
  margin-top: var(--space-3);
}

.head__code {
  font-size: var(--step--1);
}

/* Falha da exportação: aviso ao lado do caso, não painel de erro no lugar dele. */
.note--alert {
  border-inline-start-color: var(--rejeitado);
  color: var(--rejeitado);
}

/* Linha do processo: o número lidera, tribunal e vara acompanham em voz baixa. */
.case-process {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-1) var(--space-3);
  margin-bottom: var(--space-1);
  font-size: var(--step--1);
}

.case-process__number {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  color: var(--text);
}

.case-process--pending {
  font-size: var(--step--1);
}

.head__actions {
  margin-left: auto;
  display: flex;
  gap: var(--space-2);
  flex: none;
}

.split {
  display: grid;
  grid-template-columns: minmax(0, 1.9fr) minmax(0, 1fr);
  gap: var(--space-5);
  align-items: start;
}

@media (max-width: 62rem) {
  .split {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 36rem) {
  .head {
    flex-direction: column;
  }

  .head__actions {
    margin-left: 0;
  }
}

.stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
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

.panel__bar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.text-button {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: var(--step--1);
  font-weight: 650;
  cursor: pointer;
}

.panel__more,
.panel-more-error {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--line);
}

.panel-more-error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  color: var(--rejeitado);
  font-size: var(--step--1);
}

.panel-failure {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-4);
  border-bottom: 1px solid color-mix(in oklab, var(--rejeitado) 28%, var(--line));
  background: var(--rejeitado-bg);
  color: var(--text-2);
  font-size: var(--step--1);
}

.panel-failure__title {
  color: var(--rejeitado);
  font-weight: 650;
}

.panel-failure__ref {
  color: var(--text-3);
  font-size: 0.78rem;
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

.rows__title {
  display: block;
  font-weight: 600;
}

.rows__title--link {
  color: var(--text);
  text-decoration: none;
}

.rows__title--link:hover {
  color: var(--ink);
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

.parts {
  list-style: none;
  margin: 0;
  padding: 0;
}

.part {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-3);
  padding: 0.62rem var(--space-4);
  border-bottom: 1px solid var(--line);
}

.part:last-child {
  border-bottom: 0;
}

.part__name {
  font-weight: 600;
  font-size: var(--step--1);
}

.part__meta {
  font-size: 0.78rem;
  color: var(--text-3);
}

.facts {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0;
  margin: 0;
}

.facts dt,
.facts dd {
  margin: 0;
  padding: 0.5rem var(--space-4);
  border-bottom: 1px solid var(--line);
  font-size: var(--step--1);
}

.facts dt {
  color: var(--text-3);
  white-space: nowrap;
}

.facts dd {
  text-align: right;
}

.facts dt:nth-last-of-type(1),
.facts dd:nth-last-of-type(1) {
  border-bottom: 0;
}

.empty {
  padding: var(--space-6) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.empty__t {
  font-family: var(--serif);
  font-size: var(--step-1);
}

.empty__b {
  font-size: var(--step--1);
  color: var(--text-2);
  max-width: 48ch;
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

.skeleton-head {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-bottom: var(--space-6);
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
