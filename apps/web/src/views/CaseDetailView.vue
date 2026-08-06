<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { ApiError, request } from '../api/client.js';
import type { CaseDocument, CaseSummary, CursorPage, Participant } from '../api/types.js';
import FileIntakePanel from '../components/FileIntakePanel.vue';
import PreparationStatus from '../components/PreparationStatus.vue';
import StatusChip from '../components/StatusChip.vue';
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
const caseId = String(route.params.id);

const legalCase = ref<CaseSummary | null>(null);
const documents = ref<CaseDocument[]>([]);
const participants = ref<Participant[]>([]);
const loading = ref(true);
const failure = ref<ApiError | null>(null);

function toApiError(error: unknown, fallback: string): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError({ statusCode: 0, code: 'UNEXPECTED', message: fallback });
}

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

  // Documentos e participantes são painéis independentes: se um falhar, o caso continua
  // legível em vez de a página inteira virar uma tela de erro.
  const [documentPage, participantPage] = await Promise.allSettled([
    request<CursorPage<CaseDocument>>(`/cases/${caseId}/documents`, { query: { limit: 50 } }),
    request<CursorPage<Participant>>(`/cases/${caseId}/participants`, { query: { limit: 50 } }),
  ]);

  documents.value = documentPage.status === 'fulfilled' ? documentPage.value.data : [];
  participants.value = participantPage.status === 'fulfilled' ? participantPage.value.data : [];
  loading.value = false;
}

/** Depois de um envio, os aceitos já têm documento criado; a lista é recarregada. */
async function refreshDocuments(): Promise<void> {
  try {
    const page = await request<CursorPage<CaseDocument>>(`/cases/${caseId}/documents`, {
      query: { limit: 50 },
    });
    documents.value = page.data;
  } catch {
    // A lista anterior continua válida; o painel de envio já comunicou o resultado.
  }
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
  void refreshDocuments();
  preparation.value?.wake();
}

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
          <h1 id="case-title">{{ legalCase.title }}</h1>
          <div class="head__meta">
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
          <button class="btn btn--ghost" type="button" disabled>Editar caso</button>
        </div>
      </header>

      <div class="split">
        <div class="stack">
          <FileIntakePanel :case-id="caseId" @finished="onIntakeFinished" />

          <PreparationStatus
            ref="preparation"
            :case-id="caseId"
            @stages="onStages"
            @settled="refreshDocuments"
          />

          <section class="panel">
            <div class="panel__bar">
              <span class="label">Documentos</span>
              <span class="data panel__count">{{ documents.length }}</span>
            </div>

            <div v-if="documents.length === 0" class="empty">
              <p class="empty__t">Nenhum documento neste caso</p>
              <p class="empty__b">
                Envie os arquivos que o cliente mandou. O LEX OS valida, extrai o texto e identifica
                as partes antes de você abrir o primeiro documento.
              </p>
            </div>

            <div v-else class="scroll-x">
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
          </section>
        </div>

        <div class="stack">
          <section class="panel">
            <div class="panel__bar">
              <span class="label">Partes</span>
              <span class="data panel__count">{{ participants.length }}</span>
            </div>

            <div v-if="participants.length === 0" class="empty">
              <p class="empty__b">Nenhuma parte associada a este caso ainda.</p>
            </div>

            <ul v-else class="parts">
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
              <!-- A API ainda não expõe nome de usuário; mostrar UUID seria pior que dizer
                   que a informação não está disponível. Ver backlog: bloqueado por rota. -->
              <dd class="muted">
                {{ legalCase.responsibleUserId ? 'Atribuído' : 'Sem responsável' }}
              </dd>
            </dl>
          </section>
        </div>
      </div>
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
