<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { ApiError, request } from '../api/client.js';
import type { CaseDocument, CursorPage, Extraction, ExtractedEntity } from '../api/types.js';
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

const route = useRoute();
const documentId = String(route.params.id);

const doc = ref<CaseDocument | null>(null);
const extractions = ref<Extraction[]>([]);
const loading = ref(true);
const failure = ref<ApiError | null>(null);

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
      </header>

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
              <dl class="entities">
                <template v-for="(entity, position) in entities" :key="entity.id">
                  <dt class="entities__k">{{ entityTypeLabel(entity.entityType) }}</dt>
                  <dd class="entities__v">
                    <ProvenanceMark
                      :value="entity.normalizedValue"
                      :index="position + 1"
                      :source-lines="sourceLines(entity)"
                      :mono="/[0-9]/.test(entity.normalizedValue)"
                    />
                    <StatusChip label="Aguardando revisão" tone="pendente" />
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
  margin-bottom: var(--space-6);
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
</style>
