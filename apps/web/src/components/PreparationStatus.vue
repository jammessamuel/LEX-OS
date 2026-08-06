<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

import { request } from '../api/client.js';
import type { CursorPage, ProcessingJob, ProcessingJobStatus } from '../api/types.js';
import { stageLabels } from '../domain/vocabulary.js';

/**
 * Acompanha o preparo dos documentos de um caso.
 *
 * O estado vive no servidor: este componente só pergunta, em intervalos que esticam
 * (2,5 s → 15 s), pausam com a aba escondida e voltam na hora quando a pessoa retorna.
 * Quando nada mais está ativo, o polling para sozinho.
 *
 * Uma falha de rede durante o polling não vira banner: a última informação continua na
 * tela e a próxima tentativa acontece no tick seguinte. Alarme aqui só assustaria.
 */
const props = defineProps<{ caseId: string }>();
const emit = defineEmits<{
  /** Etapa ativa por documento, para a lista sobrepor o rótulo do chip. */
  stages: [byDocument: ReadonlyMap<string, string>];
  /** Algum documento terminou desde a última olhada: hora de recarregar a lista. */
  settled: [];
}>();

const ACTIVE_STATUSES: readonly ProcessingJobStatus[] = ['QUEUED', 'PROCESSING', 'RETRYING'];
const BASE_DELAY_MS = 2_500;
const MAX_DELAY_MS = 15_000;

const activeCount = ref(0);

let timer: ReturnType<typeof setTimeout> | undefined;
let delay = BASE_DELAY_MS;
let stopped = false;
let previousCount: number | null = null;

async function poll(): Promise<void> {
  if (stopped) {
    return;
  }

  try {
    const pages = await Promise.all(
      ACTIVE_STATUSES.map((status) =>
        request<CursorPage<ProcessingJob>>('/processing-jobs', {
          query: { caseId: props.caseId, status, limit: 100 },
        }),
      ),
    );
    const active = pages.flatMap((page) => page.data);

    const byDocument = new Map<string, string>();
    for (const job of active) {
      if (job.documentId !== null && !byDocument.has(job.documentId)) {
        byDocument.set(job.documentId, stageLabels[job.jobType]);
      }
    }

    activeCount.value = byDocument.size;
    emit('stages', byDocument);

    // Terminou alguma coisa desde a última resposta: a lista de documentos está
    // desatualizada e o pai precisa saber.
    if (previousCount !== null && byDocument.size < previousCount) {
      emit('settled');
    }
    previousCount = byDocument.size;

    // Com atividade, cadência cheia; sem nada ativo, o polling para — quem o acorda de
    // novo é um envio (wake) ou a volta à aba.
    if (byDocument.size > 0) {
      delay = BASE_DELAY_MS;
      schedule();
    }
  } catch {
    // Mantém a última informação e tenta com recuo maior.
    delay = Math.min(delay * 2, MAX_DELAY_MS);
    schedule();
  }
}

function schedule(): void {
  if (stopped || document.visibilityState === 'hidden') {
    return;
  }
  clearTimeout(timer);
  timer = setTimeout(() => {
    void poll();
  }, delay);
}

function onVisible(): void {
  if (document.visibilityState === 'visible' && !stopped) {
    delay = BASE_DELAY_MS;
    void poll();
  }
}

/** Um envio novo acabou de acontecer: volta à cadência cheia imediatamente. */
function wake(): void {
  delay = BASE_DELAY_MS;
  previousCount = null;
  void poll();
}

defineExpose({ wake });

onMounted(() => {
  document.addEventListener('visibilitychange', onVisible);
  void poll();
});

onBeforeUnmount(() => {
  stopped = true;
  clearTimeout(timer);
  document.removeEventListener('visibilitychange', onVisible);
});
</script>

<template>
  <p v-if="activeCount > 0" class="prep" role="status">
    <span class="prep__pulse" aria-hidden="true" />
    <span>
      <strong>
        Preparando {{ activeCount }} {{ activeCount === 1 ? 'documento' : 'documentos' }}…
      </strong>
      Pode fechar esta página — o preparo continua e é retomado quando voltar.
    </span>
  </p>
</template>

<style scoped>
.prep {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  font-size: var(--step--1);
  color: var(--text-2);
  padding: var(--space-3) var(--space-4);
  background: color-mix(in oklab, var(--ink) 7%, transparent);
  border: 1px solid color-mix(in oklab, var(--ink) 22%, transparent);
  border-radius: var(--radius);
}

.prep strong {
  color: var(--text);
}

.prep__pulse {
  flex: none;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background: var(--ink);
  align-self: center;
  animation: pulse 1.6s ease-in-out infinite;
}

@keyframes pulse {
  50% {
    opacity: 0.35;
  }
}

@media (prefers-reduced-motion: reduce) {
  .prep__pulse {
    animation: none;
  }
}
</style>
