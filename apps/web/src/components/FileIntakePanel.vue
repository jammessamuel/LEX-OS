<script setup lang="ts">
import { computed, ref } from 'vue';

import { ApiError, upload } from '../api/client.js';
import type { FileIntakeBatch, RejectedFileIntake } from '../api/types.js';
import { formatBytes } from '../domain/vocabulary.js';

const props = defineProps<{ caseId: string }>();
const emit = defineEmits<{ finished: [batch: FileIntakeBatch] }>();

/**
 * Limites espelhados dos padrões do servidor (.env.example). A pré-verificação local
 * existe só para dar retorno imediato: o servidor continua sendo a autoridade, e um
 * limite diferente configurado lá aparece como rejeição normal na resposta.
 */
const MAX_FILES = 10;
const MAX_BYTES = 26_214_400; // 25 MiB
const ACCEPTED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'text/plain']);
const ACCEPT_ATTRIBUTE =
  'application/pdf,image/jpeg,image/png,text/plain,.pdf,.jpg,.jpeg,.png,.txt';

interface LocalRejection {
  filename: string;
  reason: string;
}

const picker = ref<HTMLInputElement | null>(null);
const dragging = ref(false);
const sending = ref(false);
const queue = ref<File[]>([]);
const localRejections = ref<LocalRejection[]>([]);
const batch = ref<FileIntakeBatch | null>(null);
const failure = ref<ApiError | null>(null);

const hasResult = computed(() => batch.value !== null);
const acceptedCount = computed(() => batch.value?.accepted.length ?? 0);
const rejectedCount = computed(
  () => (batch.value?.rejected.length ?? 0) + localRejections.value.length,
);
const quarantinedCount = computed(
  () => batch.value?.accepted.filter((item) => item.file.status === 'QUARANTINED').length ?? 0,
);

function screenLocally(candidates: readonly File[]): void {
  const accepted: File[] = [];
  const refused: LocalRejection[] = [];

  for (const file of candidates) {
    if (accepted.length + queue.value.length >= MAX_FILES) {
      refused.push({ filename: file.name, reason: `Limite de ${MAX_FILES} arquivos por envio.` });
      continue;
    }
    if (file.size > MAX_BYTES) {
      refused.push({
        filename: file.name,
        reason: `Excede ${formatBytes(MAX_BYTES)}. Divida o documento ou reduza a digitalização.`,
      });
      continue;
    }
    if (file.type !== '' && !ACCEPTED_TYPES.has(file.type)) {
      refused.push({
        filename: file.name,
        reason: 'Tipo não aceito. Envie PDF, JPEG, PNG ou texto.',
      });
      continue;
    }
    accepted.push(file);
  }

  queue.value = [...queue.value, ...accepted];
  localRejections.value = [...localRejections.value, ...refused];
}

function onPick(event: Event): void {
  const input = event.target as HTMLInputElement;
  screenLocally([...(input.files ?? [])]);
  input.value = '';
}

function onDrop(event: DragEvent): void {
  dragging.value = false;
  screenLocally([...(event.dataTransfer?.files ?? [])]);
}

function removeFromQueue(index: number): void {
  queue.value = queue.value.filter((_, position) => position !== index);
}

function reset(): void {
  queue.value = [];
  localRejections.value = [];
  batch.value = null;
  failure.value = null;
}

function rejectionLabel(rejection: RejectedFileIntake): string {
  // O índice referencia a ordem enviada; o nome vem da fila local correspondente.
  return queue.value[rejection.fileIndex]?.name ?? `Arquivo ${rejection.fileIndex + 1}`;
}

async function send(): Promise<void> {
  if (queue.value.length === 0 || sending.value) {
    return;
  }
  sending.value = true;
  failure.value = null;

  try {
    const result = await upload<FileIntakeBatch>(
      `/cases/${props.caseId}/files/upload`,
      queue.value,
    );
    batch.value = result;
    emit('finished', result);
  } catch (error) {
    failure.value =
      error instanceof ApiError
        ? error
        : new ApiError({
            statusCode: 0,
            code: 'UNEXPECTED',
            message: 'Não foi possível enviar os arquivos.',
          });
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <section class="panel" aria-labelledby="intake-title">
    <div class="panel__bar">
      <span id="intake-title" class="label">Enviar arquivos</span>
      <span v-if="queue.length > 0 && !hasResult" class="data panel__count">
        {{ queue.length }} de {{ MAX_FILES }}
      </span>
    </div>

    <!-- Resultado do lote: parcial é o caso comum, e os três números aparecem juntos. -->
    <div v-if="hasResult" class="panel__pad">
      <div class="tally" role="status">
        <div class="tally__cell" data-tone="ok">
          <div class="tally__n data">{{ acceptedCount }}</div>
          <div class="tally__k">aceitos</div>
        </div>
        <div class="tally__cell" data-tone="erro">
          <div class="tally__n data">{{ rejectedCount }}</div>
          <div class="tally__k">recusados</div>
        </div>
        <div class="tally__cell" data-tone="pendente">
          <div class="tally__n data">{{ quarantinedCount }}</div>
          <div class="tally__k">em quarentena</div>
        </div>
      </div>

      <ul v-if="batch && batch.rejected.length > 0" class="refusals">
        <li v-for="rejection in batch.rejected" :key="rejection.fileIndex" class="refusal">
          <span class="refusal__name">{{ rejectionLabel(rejection) }}</span>
          <span class="refusal__why">{{ rejection.message }}</span>
        </li>
      </ul>

      <p class="hint">
        Os aceitos entraram na fila de preparação: validação, extração de texto e classificação
        acontecem no servidor e você pode acompanhar pelo caso.
      </p>

      <button class="btn btn--ghost" type="button" @click="reset">Enviar mais arquivos</button>
    </div>

    <div v-else class="panel__pad">
      <div
        class="drop"
        :class="{ 'drop--active': dragging }"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="onDrop"
      >
        <div class="drop__text">
          <p class="drop__title">Arraste os arquivos aqui</p>
          <p class="drop__rules">
            PDF, JPEG, PNG e texto · até {{ formatBytes(MAX_BYTES) }} por arquivo ·
            {{ MAX_FILES }} por envio
          </p>
        </div>
        <button class="btn btn--ghost" type="button" @click="picker?.click()">
          Selecionar arquivos
        </button>
        <input
          ref="picker"
          type="file"
          multiple
          :accept="ACCEPT_ATTRIBUTE"
          aria-label="Selecionar arquivos para envio"
          class="visually-hidden"
          @change="onPick"
        />
      </div>

      <ul v-if="queue.length > 0" class="queue">
        <li v-for="(file, index) in queue" :key="`${file.name}-${index}`" class="queue__item">
          <span class="queue__name">{{ file.name }}</span>
          <span class="queue__size data">{{ formatBytes(file.size) }}</span>
          <button
            class="queue__remove"
            type="button"
            :aria-label="`Remover ${file.name}`"
            @click="removeFromQueue(index)"
          >
            Remover
          </button>
        </li>
      </ul>

      <ul v-if="localRejections.length > 0" class="refusals">
        <li v-for="(rejection, index) in localRejections" :key="index" class="refusal">
          <span class="refusal__name">{{ rejection.filename }}</span>
          <span class="refusal__why">{{ rejection.reason }}</span>
        </li>
      </ul>

      <p v-if="failure" class="failure" role="alert">
        {{ failure.message }}
        <span v-if="failure.requestId" class="failure__ref data">
          Referência: {{ failure.requestId }}
        </span>
      </p>

      <div v-if="queue.length > 0" class="actions">
        <button class="btn" type="button" :disabled="sending" @click="send">
          {{
            sending ? 'Enviando…' : `Enviar ${queue.length} arquivo${queue.length > 1 ? 's' : ''}`
          }}
        </button>
        <button class="btn btn--ghost" type="button" :disabled="sending" @click="reset">
          Limpar
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
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

.panel__pad {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.drop {
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-lg);
  padding: var(--space-5) var(--space-4);
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.drop--active {
  border-color: var(--ink);
  background: color-mix(in oklab, var(--ink) 7%, transparent);
}

.drop__text {
  flex: 1 1 14rem;
  min-width: 0;
}

.drop__title {
  font-family: var(--serif);
  font-size: var(--step-1);
  margin-bottom: var(--space-1);
}

.drop__rules {
  font-size: var(--step--1);
  color: var(--text-2);
}

.queue {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
}

.queue__item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--line);
  font-size: var(--step--1);
}

.queue__item:last-child {
  border-bottom: 0;
}

.queue__name {
  font-weight: 600;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue__size {
  margin-left: auto;
  color: var(--text-3);
  font-size: 0.78rem;
  white-space: nowrap;
}

.queue__remove {
  font: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-2);
  background: none;
  border: 0;
  cursor: pointer;
  padding: 0.15rem 0.3rem;
  border-radius: var(--radius-sm);
}

.queue__remove:hover {
  color: var(--rejeitado);
  background: var(--rejeitado-bg);
}

.refusals {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.refusal {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
  font-size: var(--step--1);
  padding: var(--space-2) var(--space-3);
  background: var(--rejeitado-bg);
  border: 1px solid color-mix(in oklab, var(--rejeitado) 24%, transparent);
  border-radius: var(--radius);
}

.refusal__name {
  font-weight: 600;
  color: var(--rejeitado);
}

.refusal__why {
  color: var(--text-2);
}

.failure {
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

.failure__ref {
  font-size: 0.78rem;
  color: var(--text-3);
}

.actions {
  display: flex;
  gap: var(--space-2);
}

.tally {
  display: flex;
  flex-wrap: wrap;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
}

.tally__cell {
  flex: 1 1 7rem;
  padding: var(--space-3) var(--space-4);
  border-right: 1px solid var(--line);
}

.tally__cell:last-child {
  border-right: 0;
}

.tally__n {
  font-size: 1.75rem;
  line-height: 1.1;
}

.tally__k {
  font-size: 0.78rem;
  color: var(--text-3);
  margin-top: 0.15rem;
}

.tally__cell[data-tone='ok'] .tally__n {
  color: var(--confirmado);
}

.tally__cell[data-tone='erro'] .tally__n {
  color: var(--rejeitado);
}

.tally__cell[data-tone='pendente'] .tally__n {
  color: var(--pendente);
}

.hint {
  font-size: var(--step--1);
  color: var(--text-2);
  max-width: 52ch;
}
</style>
