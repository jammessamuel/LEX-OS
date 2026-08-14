<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ApiError, request, type NoContent } from '../api/client.js';
import type {
  CaseDocument,
  CursorPage,
  Extraction,
  ExtractedEntity,
  ProcessingJob,
} from '../api/types.js';
import ProvenanceMark from '../components/ProvenanceMark.vue';
import StatusChip from '../components/StatusChip.vue';
import {
  documentSituation,
  entityTypeLabel,
  extractionTypeLabels,
  formatBytes,
  formatConfidence,
  formatDateTime,
} from '../domain/vocabulary.js';
import { useSessionStore } from '../stores/session.js';

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const documentId = String(route.params.id);

const doc = ref<CaseDocument | null>(null);
const extractions = ref<Extraction[]>([]);
const loading = ref(true);
const failure = ref<ApiError | null>(null);
const confirmationFailure = ref<ApiError | null>(null);
const confirmingEntityId = ref<string | null>(null);
const editing = ref(false);
const saving = ref(false);
const operating = ref<string | null>(null);
const operationFailure = ref<ApiError | null>(null);
const operationMessage = ref('');
const editForm = reactive({
  title: '',
  description: '',
  documentDate: '',
  issuer: '',
  recipient: '',
  isOriginal: true,
  isSigned: '' as '' | 'true' | 'false',
  isLegible: '' as '' | 'true' | 'false',
});

interface DownloadUrlResponse {
  url: string;
  expiresAt: string;
}

function toApiError(error: unknown, message: string): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError({ statusCode: 0, code: 'UNEXPECTED', message });
}

function booleanOrNull(value: '' | 'true' | 'false'): boolean | null {
  return value === '' ? null : value === 'true';
}

function beginEditing(): void {
  if (doc.value === null) return;
  editForm.title = doc.value.title;
  editForm.description = doc.value.description ?? '';
  editForm.documentDate = doc.value.documentDate ?? '';
  editForm.issuer = doc.value.issuer ?? '';
  editForm.recipient = doc.value.recipient ?? '';
  editForm.isOriginal = doc.value.isOriginal;
  editForm.isSigned =
    doc.value.isSigned === null ? '' : (String(doc.value.isSigned) as 'true' | 'false');
  editForm.isLegible =
    doc.value.isLegible === null ? '' : (String(doc.value.isLegible) as 'true' | 'false');
  operationFailure.value = null;
  editing.value = true;
}

async function saveMetadata(): Promise<void> {
  saving.value = true;
  operationFailure.value = null;
  try {
    doc.value = await request<CaseDocument>(`/documents/${documentId}`, {
      method: 'PATCH',
      body: {
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        documentDate: editForm.documentDate || null,
        issuer: editForm.issuer.trim() || null,
        recipient: editForm.recipient.trim() || null,
        isOriginal: editForm.isOriginal,
        isSigned: booleanOrNull(editForm.isSigned),
        isLegible: booleanOrNull(editForm.isLegible),
      },
    });
    editing.value = false;
    operationMessage.value = 'Correção humana salva.';
  } catch (error) {
    operationFailure.value = toApiError(error, 'Não foi possível salvar a correção.');
  } finally {
    saving.value = false;
  }
}

async function download(): Promise<void> {
  if (doc.value === null) return;
  operating.value = 'download';
  operationFailure.value = null;
  operationMessage.value = '';
  try {
    const signed = await request<DownloadUrlResponse>(`/files/${doc.value.fileId}/download-url`);
    const anchor = document.createElement('a');
    anchor.href = signed.url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.click();
    operationMessage.value = 'Download autorizado por 60 segundos.';
  } catch (error) {
    operationFailure.value = toApiError(error, 'Não foi possível autorizar o download.');
  } finally {
    operating.value = null;
  }
}

async function reprocess(): Promise<void> {
  operating.value = 'reprocess';
  operationFailure.value = null;
  operationMessage.value = '';
  try {
    const job = await request<ProcessingJob>(`/documents/${documentId}/reprocess`, {
      method: 'POST',
    });
    operationMessage.value =
      job.status === 'QUEUED'
        ? 'Novo preparo colocado na fila. O histórico anterior foi preservado.'
        : 'Novo preparo solicitado.';
  } catch (error) {
    operationFailure.value = toApiError(error, 'Não foi possível solicitar um novo preparo.');
  } finally {
    operating.value = null;
  }
}

async function removeDocument(): Promise<void> {
  if (
    !window.confirm('Excluir este documento do caso? O histórico de auditoria será preservado.')
  ) {
    return;
  }
  operating.value = 'delete';
  operationFailure.value = null;
  try {
    await request<NoContent>(`/documents/${documentId}`, { method: 'DELETE' });
    await router.replace(
      doc.value?.caseId
        ? { name: 'case-detail', params: { id: doc.value.caseId } }
        : { name: 'cases' },
    );
  } catch (error) {
    operationFailure.value = toApiError(error, 'Não foi possível excluir o documento.');
  } finally {
    operating.value = null;
  }
}

async function load(): Promise<void> {
  loading.value = true;
  failure.value = null;

  try {
    const [document, extractionPage] = await Promise.all([
      request<CaseDocument>(`/documents/${documentId}`),
      request<CursorPage<Extraction>>(`/documents/${documentId}/extractions`, {
        query: { limit: 100 },
      }),
    ]);
    doc.value = document;
    extractions.value = extractionPage.data;
  } catch (error) {
    failure.value =
      error instanceof ApiError
        ? error
        : new ApiError({
            statusCode: 0,
            code: 'UNEXPECTED',
            message: 'Não foi possível carregar o documento.',
          });
  } finally {
    loading.value = false;
  }
}

/** Retorna a execução mais recente de cada tipo; o histórico completo continua preservado. */
function latestOf(...types: readonly string[]): Extraction | undefined {
  return extractions.value.find(
    (extraction) => types.includes(extraction.extractionType) && extraction.status === 'COMPLETED',
  );
}

const entityExtraction = computed(() => latestOf('ENTITY_EXTRACTION'));
const entities = computed<ExtractedEntity[]>(() => entityExtraction.value?.entities ?? []);
const textExtraction = computed(() => latestOf('OCR', 'TRANSCRIPTION'));

function sourceLines(entity: ExtractedEntity): string[] {
  const extraction = entityExtraction.value;
  const lines: string[] = [];

  const place: string[] = [];
  if (doc.value) {
    place.push(doc.value.file.filename);
  }
  if (entity.pageNumber !== null) {
    place.push(`página ${entity.pageNumber}`);
  }
  if (entity.startOffset !== null && entity.endOffset !== null) {
    place.push(`caracteres ${entity.startOffset}–${entity.endOffset}`);
  }
  if (place.length > 0) {
    lines.push(place.join(' · '));
  }

  if (extraction) {
    lines.push(`${extraction.provider} · ${extraction.modelName}`);
  }
  lines.push(`confiança ${formatConfidence(entity.confidenceScore)}`);

  if (entity.originalValue !== entity.normalizedValue) {
    lines.push(`no documento: "${entity.originalValue}"`);
  }

  return lines;
}

async function confirmEntity(entity: ExtractedEntity): Promise<void> {
  confirmationFailure.value = null;
  confirmingEntityId.value = entity.id;
  try {
    const confirmed = await request<ExtractedEntity>(`/extracted-entities/${entity.id}/confirm`, {
      method: 'POST',
    });
    extractions.value = extractions.value.map((extraction) => ({
      ...extraction,
      entities: extraction.entities.map((current) =>
        current.id === confirmed.id ? confirmed : current,
      ),
    }));
  } catch (error) {
    const apiFailure =
      error instanceof ApiError
        ? error
        : new ApiError({
            statusCode: 0,
            code: 'UNEXPECTED',
            message: 'Não foi possível confirmar o dado.',
          });
    if (apiFailure.code === 'EXTRACTED_ENTITY_ALREADY_CONFIRMED') {
      await load();
    } else {
      confirmationFailure.value = apiFailure;
    }
  } finally {
    confirmingEntityId.value = null;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <section aria-labelledby="document-title">
    <p class="crumb">
      <RouterLink :to="{ name: 'cases' }">Casos</RouterLink>
      <span aria-hidden="true">/</span>
      <RouterLink
        v-if="doc?.caseId"
        :to="{ name: 'case-detail', params: { id: doc.caseId } }"
        class="data"
      >
        caso
      </RouterLink>
      <span aria-hidden="true">/</span>
      <span>{{ doc?.title ?? '…' }}</span>
    </p>

    <div v-if="loading" class="skeleton-stack" aria-busy="true">
      <p class="visually-hidden">Carregando o documento.</p>
      <span class="skeleton" style="width: 24rem; height: 1.8rem" />
      <span class="skeleton" style="width: 30rem" />
      <span class="skeleton" style="width: 26rem" />
    </div>

    <div v-else-if="failure" class="state state--error" role="alert">
      <h2 class="state__title">Não foi possível abrir este documento</h2>
      <p class="state__body">{{ failure.message }}</p>
      <p v-if="failure.requestId" class="state__ref data">
        Referência para o suporte: {{ failure.requestId }}
      </p>
      <button class="btn" type="button" @click="load()">Tentar novamente</button>
    </div>

    <template v-else-if="doc">
      <header class="head">
        <div>
          <h1 id="document-title">{{ doc.title }}</h1>
          <div class="head__meta">
            <StatusChip :label="documentSituation(doc).label" :tone="documentSituation(doc).tone" />
            <span class="muted data head__file">
              {{ doc.file.filename }} · {{ formatBytes(doc.file.sizeBytes) }}
            </span>
            <span v-if="doc.documentType" class="muted head__type">
              {{ doc.documentType.name }}
            </span>
          </div>
        </div>
        <div class="head__actions">
          <button
            class="btn btn--ghost"
            type="button"
            :disabled="operating !== null"
            @click="download"
          >
            {{ operating === 'download' ? 'Autorizando…' : 'Baixar original' }}
          </button>
          <button
            v-if="session.can('documents.update')"
            class="btn btn--ghost"
            type="button"
            @click="beginEditing"
          >
            Corrigir dados
          </button>
          <button
            v-if="session.can('documents.manage')"
            class="btn btn--ghost"
            type="button"
            :disabled="operating !== null"
            @click="reprocess"
          >
            {{ operating === 'reprocess' ? 'Solicitando…' : 'Preparar novamente' }}
          </button>
          <button
            v-if="session.can('documents.delete')"
            class="btn btn--danger"
            type="button"
            :disabled="operating !== null"
            @click="removeDocument"
          >
            Excluir
          </button>
        </div>
      </header>

      <div v-if="operationFailure" class="operation operation--error" role="alert">
        {{ operationFailure.message }}
      </div>
      <div v-else-if="operationMessage" class="operation" role="status">
        {{ operationMessage }}
      </div>

      <form v-if="editing" class="panel edit-form" @submit.prevent="saveMetadata">
        <div class="panel__bar">
          <span class="label">Correção humana</span>
          <button class="text-button" type="button" @click="editing = false">Fechar</button>
        </div>
        <div class="edit-form__fields">
          <label class="field edit-form__wide">
            <span class="label">Título</span>
            <input v-model="editForm.title" required maxlength="255" />
          </label>
          <label class="field edit-form__wide">
            <span class="label">Descrição</span>
            <textarea v-model="editForm.description" rows="3" maxlength="20000" />
          </label>
          <label class="field">
            <span class="label">Data do documento</span>
            <input v-model="editForm.documentDate" type="date" />
          </label>
          <label class="field">
            <span class="label">Emissor</span>
            <input v-model="editForm.issuer" maxlength="255" />
          </label>
          <label class="field">
            <span class="label">Destinatário</span>
            <input v-model="editForm.recipient" maxlength="255" />
          </label>
          <label class="field">
            <span class="label">Assinatura</span>
            <select v-model="editForm.isSigned">
              <option value="">Não verificada</option>
              <option value="true">Assinado</option>
              <option value="false">Não assinado</option>
            </select>
          </label>
          <label class="field">
            <span class="label">Legibilidade</span>
            <select v-model="editForm.isLegible">
              <option value="">Não verificada</option>
              <option value="true">Legível</option>
              <option value="false">Ilegível</option>
            </select>
          </label>
          <label class="check">
            <input v-model="editForm.isOriginal" type="checkbox" />
            <span>Este é o documento original</span>
          </label>
        </div>
        <div class="edit-form__actions">
          <button class="btn" type="submit" :disabled="saving">
            {{ saving ? 'Salvando…' : 'Salvar correção' }}
          </button>
        </div>
      </form>

      <div class="split">
        <div class="stack">
          <!-- Cada dado identificado carrega uma nota com sua origem. -->
          <section class="panel" aria-labelledby="entities-title">
            <div class="panel__bar">
              <span id="entities-title" class="label">Dados identificados</span>
              <span v-if="entities.length > 0" class="data panel__count">
                {{ entities.length }}
              </span>
            </div>

            <div v-if="entities.length === 0" class="empty">
              <p class="empty__b">
                Nenhum dado identificado ainda. Eles aparecem aqui quando a preparação do documento
                termina, cada um com a página e o trecho de origem.
              </p>
            </div>

            <template v-else>
              <div v-if="confirmationFailure" class="entity-error" role="alert">
                {{ confirmationFailure.message }}
              </div>
              <dl class="entities">
                <template v-for="(entity, position) in entities" :key="entity.id">
                  <dt class="entities__k">{{ entityTypeLabel(entity.entityType) }}</dt>
                  <dd class="entities__v">
                    <ProvenanceMark
                      :value="entity.normalizedValue"
                      :index="position + 1"
                      :source-lines="sourceLines(entity)"
                      :mono="/[0-9]/.test(entity.normalizedValue)"
                      :confirmed="entity.confirmedByUser"
                    />
                    <StatusChip
                      :label="entity.confirmedByUser ? 'Confirmado' : 'Aguardando revisão'"
                      :tone="entity.confirmedByUser ? 'confirmado' : 'pendente'"
                    />
                    <button
                      v-if="!entity.confirmedByUser && session.can('documents.manage')"
                      class="btn btn--ghost entity-confirm"
                      type="button"
                      :disabled="confirmingEntityId === entity.id"
                      @click="confirmEntity(entity)"
                    >
                      {{ confirmingEntityId === entity.id ? 'Confirmando…' : 'Confirmar' }}
                    </button>
                  </dd>
                </template>
              </dl>
              <p class="entities__note">
                Dados extraídos automaticamente permanecem marcados até a confirmação humana. Passe
                o cursor ou navegue com o teclado para ver a origem de cada um.
              </p>
            </template>
          </section>

          <!-- O texto extraído usa tipografia própria para leitura prolongada. -->
          <section v-if="textExtraction?.rawText" class="panel">
            <div class="panel__bar">
              <span class="label">Texto extraído</span>
              <span class="data panel__count">
                confiança {{ formatConfidence(textExtraction.confidenceScore) }}
              </span>
            </div>
            <div class="reading">
              <p class="reading__text">{{ textExtraction.rawText }}</p>
            </div>
          </section>
        </div>

        <div class="stack">
          <!-- A trilha preserva cada execução com provedor, modelo e horário. -->
          <section class="panel" aria-labelledby="history-title">
            <div class="panel__bar">
              <span id="history-title" class="label">Histórico de preparação</span>
              <span class="data panel__count">{{ extractions.length }}</span>
            </div>

            <div v-if="extractions.length === 0" class="empty">
              <p class="empty__b">Nenhuma execução registrada ainda.</p>
            </div>

            <ol v-else class="trail">
              <li v-for="extraction in extractions" :key="extraction.id" class="trail__item">
                <span class="trail__what">
                  {{ extractionTypeLabels[extraction.extractionType] }}
                </span>
                <span class="trail__who data">
                  {{ extraction.provider }} · {{ extraction.modelName }}
                </span>
                <span class="trail__when data">
                  {{ formatDateTime(extraction.createdAt) }} · confiança
                  {{ formatConfidence(extraction.confidenceScore) }}
                </span>
              </li>
            </ol>
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
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.head__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-inline-start: auto;
}

.head__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-4);
  margin-top: var(--space-3);
}

.head__file,
.head__type {
  font-size: var(--step--1);
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

.operation {
  margin: calc(-1 * var(--space-3)) 0 var(--space-4);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  color: var(--text-2);
  background: var(--surface);
}

.operation--error {
  border-color: color-mix(in oklab, var(--rejeitado) 35%, var(--line));
  color: var(--rejeitado);
  background: var(--rejeitado-bg);
}

.edit-form {
  margin-bottom: var(--space-5);
}

.edit-form__fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
  padding: var(--space-4);
}

.edit-form__wide {
  grid-column: 1 / -1;
}

.edit-form__actions {
  display: flex;
  justify-content: flex-end;
  padding: 0 var(--space-4) var(--space-4);
}

.text-button {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  cursor: pointer;
}

.check {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--step--1);
}

.entities {
  display: grid;
  grid-template-columns: minmax(9rem, auto) minmax(0, 1fr);
  gap: 0;
  margin: 0;
}

.entities__k,
.entities__v {
  margin: 0;
  padding: 0.62rem var(--space-4);
  border-bottom: 1px solid var(--line);
}

.entities__k {
  font-size: 0.78rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--text-3);
  align-self: baseline;
  padding-top: 0.75rem;
}

.entities__v {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-3);
  font-size: var(--step-0);
}

.entities__note {
  padding: var(--space-3) var(--space-4);
  font-size: var(--step--1);
  color: var(--text-3);
}

.entity-confirm {
  padding-block: 0.35rem;
}

.entity-error {
  padding: var(--space-3) var(--space-4);
  color: var(--rejeitado);
  background: var(--rejeitado-bg);
  border-bottom: 1px solid color-mix(in oklab, var(--rejeitado) 30%, var(--line));
  font-size: var(--step--1);
}

.reading {
  padding: var(--space-4);
}

.reading__text {
  font-family: var(--serif);
  font-size: var(--step-0);
  line-height: 1.7;
  max-width: 65ch;
  white-space: pre-wrap;
}

.trail {
  list-style: none;
  margin: 0;
  padding: 0;
}

.trail__item {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.62rem var(--space-4);
  border-bottom: 1px solid var(--line);
}

.trail__item:last-child {
  border-bottom: 0;
}

.trail__what {
  font-weight: 600;
  font-size: var(--step--1);
}

.trail__who,
.trail__when {
  font-size: 0.78rem;
  color: var(--text-3);
}

.empty {
  padding: var(--space-5) var(--space-4);
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

.skeleton-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
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

@media (max-width: 48rem) {
  .head {
    flex-direction: column;
  }

  .head__actions {
    justify-content: flex-start;
    margin-inline-start: 0;
  }

  .edit-form__fields {
    grid-template-columns: 1fr;
  }

  .edit-form__wide {
    grid-column: auto;
  }
}
</style>
