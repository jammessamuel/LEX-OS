<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { ApiError, request } from '../api/client.js';
import type {
  CaseSummary,
  CursorPage,
  GroundedAnswerResponse,
  SearchMode,
  SearchResponse,
} from '../api/types.js';
import { highlightExcerpt } from '../domain/highlight.js';

const cases = ref<CaseSummary[]>([]);
const caseId = ref('');
const query = ref('');
const mode = ref<SearchMode>('HYBRID');
const result = ref<SearchResponse | null>(null);
const answer = ref<GroundedAnswerResponse | null>(null);
// A consulta que produziu os resultados na tela: o realce segue o que foi executado, não o
// que está sendo digitado agora no campo.
const executedQuery = ref('');
const loadingCases = ref(true);
const submitting = ref<'answer' | 'search' | null>(null);
const failure = ref<ApiError | null>(null);

function apiError(error: unknown, fallback: string): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError({ statusCode: 0, code: 'UNEXPECTED', message: fallback });
}

async function loadCases(): Promise<void> {
  loadingCases.value = true;
  try {
    const page = await request<CursorPage<CaseSummary>>('/cases', { query: { limit: 100 } });
    cases.value = page.data;
    caseId.value ||= page.data[0]?.id ?? '';
  } catch (error) {
    failure.value = apiError(error, 'Não foi possível carregar os casos para pesquisa.');
  } finally {
    loadingCases.value = false;
  }
}

function valid(): boolean {
  failure.value = null;
  if (caseId.value === '') {
    failure.value = new ApiError({
      statusCode: 400,
      code: 'CASE_REQUIRED',
      message: 'Escolha o caso que delimita as fontes autorizadas.',
    });
    return false;
  }
  if (query.value.trim().length < 2) {
    failure.value = new ApiError({
      statusCode: 400,
      code: 'QUERY_REQUIRED',
      message: 'Escreva pelo menos dois caracteres.',
    });
    return false;
  }
  return true;
}

async function search(): Promise<void> {
  if (!valid()) return;
  submitting.value = 'search';
  result.value = null;
  answer.value = null;
  try {
    result.value = await request<SearchResponse>('/search', {
      method: 'POST',
      body: { query: query.value.trim(), caseId: caseId.value, mode: mode.value, limit: 10 },
    });
    executedQuery.value = query.value.trim();
  } catch (error) {
    failure.value = apiError(error, 'Não foi possível pesquisar o acervo.');
  } finally {
    submitting.value = null;
  }
}

async function ask(): Promise<void> {
  if (!valid()) return;
  submitting.value = 'answer';
  result.value = null;
  answer.value = null;
  try {
    answer.value = await request<GroundedAnswerResponse>('/assistant/answers', {
      method: 'POST',
      body: { question: query.value.trim(), caseId: caseId.value, mode: mode.value, limit: 3 },
    });
  } catch (error) {
    failure.value = apiError(error, 'Não foi possível produzir a resposta ancorada.');
  } finally {
    submitting.value = null;
  }
}

onMounted(() => void loadCases());
</script>

<template>
  <section aria-labelledby="search-title">
    <header class="head">
      <p class="label">Memória autorizada</p>
      <h1 id="search-title">Busca no acervo</h1>
      <p class="muted head__lede">
        Pesquise trechos ou peça uma resposta. O sistema usa apenas documentos que você pode abrir.
      </p>
    </header>

    <form class="searchbox" @submit.prevent="search">
      <label class="field">
        <span class="label">Caso</span>
        <select v-model="caseId" :disabled="loadingCases || submitting !== null">
          <option value="">Escolha um caso</option>
          <option v-for="item in cases" :key="item.id" :value="item.id">
            {{ item.internalCode }} — {{ item.title }}
          </option>
        </select>
      </label>

      <label class="field searchbox__question">
        <span class="label">O que você precisa localizar?</span>
        <textarea
          v-model="query"
          rows="3"
          maxlength="500"
          placeholder="Ex.: Qual data consta no contrato?"
          :disabled="submitting !== null"
        />
        <span class="field__hint">A pergunta e a resposta não são gravadas na auditoria.</span>
      </label>

      <div class="searchbox__actions">
        <label class="field mode">
          <span class="label">Modo</span>
          <select v-model="mode" :disabled="submitting !== null">
            <option value="HYBRID">Texto e significado</option>
            <option value="LEXICAL">Correspondência textual</option>
            <option value="SEMANTIC">Semelhança de significado</option>
          </select>
        </label>
        <button class="btn btn--ghost" type="submit" :disabled="submitting !== null">
          {{ submitting === 'search' ? 'Pesquisando…' : 'Buscar trechos' }}
        </button>
        <button class="btn" type="button" :disabled="submitting !== null" @click="ask">
          {{ submitting === 'answer' ? 'Analisando fontes…' : 'Responder com fontes' }}
        </button>
      </div>
    </form>

    <div v-if="failure" class="state state--error result" role="alert">
      <h2 class="state__title">Não foi possível concluir</h2>
      <p class="state__body">{{ failure.message }}</p>
      <p v-if="failure.requestId" class="state__ref data">Referência: {{ failure.requestId }}</p>
    </div>

    <div v-else-if="result?.status === 'INSUFFICIENT_EVIDENCE'" class="state result" role="status">
      <h2 class="state__title">Não há fonte autorizada suficiente</h2>
      <p class="state__body">Tente outra formulação ou revise os documentos disponíveis no caso.</p>
    </div>

    <section v-else-if="result" class="result panel" aria-labelledby="results-title">
      <div class="panel__bar">
        <h2 id="results-title">Trechos encontrados</h2>
        <span class="data muted">{{ result.resultCount }}</span>
      </div>
      <ol class="sources">
        <li v-for="source in result.results" :key="source.chunkId" class="source">
          <blockquote>
            <!-- Segmentos como texto, nunca v-html: o trecho é conteúdo de documento do
                 cliente e continua sendo evidência não confiável. -->
            <span
              v-for="(segment, index) in highlightExcerpt(source.excerpt, executedQuery)"
              :key="index"
              :class="{ source__mark: segment.match }"
              >{{ segment.text }}</span
            >
          </blockquote>
          <p class="source__meta data">
            página {{ source.citation.pageNumber }} · caracteres
            {{ source.citation.startOffset }}–{{ source.citation.endOffset }}
          </p>
          <RouterLink :to="{ name: 'document-detail', params: { id: source.citation.documentId } }">
            Abrir documento
          </RouterLink>
        </li>
      </ol>
    </section>

    <div v-else-if="answer?.status === 'INSUFFICIENT_EVIDENCE'" class="state result" role="status">
      <h2 class="state__title">O sistema recusou responder</h2>
      <p class="state__body">
        Nenhuma fonte autorizada sustenta uma resposta. Nenhuma afirmação foi inventada.
      </p>
    </div>

    <section v-else-if="answer" class="result answer" aria-labelledby="answer-title">
      <div class="answer__flag">Conteúdo gerado por máquina</div>
      <h2 id="answer-title">Resposta ancorada</h2>
      <ol class="claims">
        <li v-for="(claim, index) in answer.claims" :key="index">
          <p>{{ claim.text }}</p>
          <ul class="citations" aria-label="Fontes da afirmação">
            <li v-for="citation in claim.citations" :key="citation.contentHash">
              <RouterLink :to="{ name: 'document-detail', params: { id: citation.documentId } }">
                Documento · página {{ citation.pageNumber }} · caracteres
                {{ citation.startOffset }}–{{ citation.endOffset }}
              </RouterLink>
            </li>
          </ul>
        </li>
      </ol>
      <p class="answer__disclaimer">{{ answer.disclaimer }}</p>
    </section>
  </section>
</template>

<style scoped>
.head {
  margin-bottom: var(--space-5);
}

.head__lede {
  margin-top: var(--space-2);
  max-width: 68ch;
}

.searchbox,
.panel,
.answer {
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
}

.searchbox {
  display: grid;
  grid-template-columns: minmax(16rem, 0.7fr) minmax(0, 1.3fr);
  gap: var(--space-4);
  padding: var(--space-5);
}

.field select,
.field textarea {
  width: 100%;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius);
  padding: 0.58rem 0.7rem;
  font: inherit;
}

.field textarea {
  resize: vertical;
  min-height: 7rem;
}

.searchbox__actions {
  grid-column: 1 / -1;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  gap: var(--space-3);
}

.mode {
  width: min(18rem, 100%);
  margin-right: auto;
}

.result {
  margin-top: var(--space-5);
}

.panel__bar {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: var(--space-4);
  background: var(--surface-sunk);
  border-bottom: 1px solid var(--line);
}

.panel__bar h2 {
  font-size: var(--step-1);
}

.sources,
.claims,
.citations {
  margin: 0;
}

.sources {
  list-style: none;
  padding: 0;
}

.source {
  padding: var(--space-4);
  border-bottom: 1px solid var(--line);
}

.source:last-child {
  border-bottom: 0;
}

.source blockquote {
  margin: 0 0 var(--space-3);
  font-family: var(--serif);
  line-height: 1.7;
}

.source__meta {
  color: var(--text-3);
  font-size: var(--step--1);
  margin-bottom: var(--space-2);
}

.source__mark {
  background: color-mix(in oklab, var(--pendente) 26%, transparent);
  border-radius: 2px;
  padding: 0 0.1em;
}

.source a,
.citations a {
  color: var(--ink);
}

.answer {
  position: relative;
  padding: var(--space-5);
  border-left: 3px solid var(--informativo);
}

.answer__flag {
  display: inline-block;
  margin-bottom: var(--space-3);
  color: var(--informativo);
  font-size: var(--step--1);
  font-weight: 650;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.claims {
  display: grid;
  gap: var(--space-5);
  padding: var(--space-5) 0 var(--space-4) 1.3rem;
}

.citations {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3) 0 0 1.2rem;
  font-size: var(--step--1);
}

.answer__disclaimer {
  color: var(--text-2);
  font-size: var(--step--1);
  border-top: 1px solid var(--line);
  padding-top: var(--space-3);
}

@media (max-width: 54rem) {
  .searchbox {
    grid-template-columns: 1fr;
  }

  .searchbox__actions {
    align-items: stretch;
    flex-direction: column;
  }

  .mode {
    width: 100%;
  }
}
</style>
