<script setup lang="ts">
import { onBeforeUnmount, ref, useId } from 'vue';

/**
 * Marcador de procedência em forma de nota de rodapé.
 *
 * Dado extraído por IA aparece com sublinhado pontilhado e numeral sobrescrito, como uma
 * citação em peça impressa. A fonte — arquivo, página, trecho, modelo, confiança — é
 * revelada no hover e no foco de teclado, nunca escondida atrás de clique. Sóbrio de
 * propósito: o advogado precisa saber, não ser interrompido.
 *
 * A nota é posicionada em coordenadas de viewport, e não em relação ao marcador, porque os
 * painéis que a hospedam usam `overflow: hidden` para arredondar os cantos — e overflow de
 * ancestral recorta elemento absoluto, deixando a nota cortada na borda do cartão. Elemento
 * fixo não é recortado por overflow, então a nota sai inteira de dentro de qualquer painel,
 * sem obrigar cada tela a abrir o seu.
 */
defineProps<{
  value: string;
  index: number;
  sourceLines: readonly string[];
  confirmed?: boolean;
  /** Identificador jurídico usa mono e números tabulares. */
  mono?: boolean;
}>();

const tooltipId = useId();
const trigger = ref<HTMLElement | null>(null);
const tooltip = ref<HTMLElement | null>(null);
const open = ref(false);
const position = ref({ top: 0, left: 0 });

/** Folga entre o marcador e a nota, e entre a nota e a borda da janela. */
const GAP = 8;
const EDGE = 12;

function place(): void {
  const anchor = trigger.value;
  const note = tooltip.value;
  if (anchor === null || note === null) {
    return;
  }
  const mark = anchor.getBoundingClientRect();
  const size = note.getBoundingClientRect();

  // Abaixo por padrão; acima quando não couber, para a nota nunca sair pelo rodapé.
  const below = mark.bottom + GAP;
  const above = mark.top - size.height - GAP;
  const fitsBelow = below + size.height <= window.innerHeight - EDGE;
  const top = fitsBelow || above < EDGE ? below : above;

  const maxLeft = window.innerWidth - size.width - EDGE;
  const left = Math.max(EDGE, Math.min(mark.left, Math.max(EDGE, maxLeft)));

  position.value = { top, left };
}

function show(): void {
  open.value = true;
  // A nota precisa estar medida antes de ser posicionada: `visibility` a mantém no fluxo,
  // então o retângulo já é real neste ponto.
  place();
  window.addEventListener('scroll', place, true);
  window.addEventListener('resize', place);
}

function hide(): void {
  open.value = false;
  window.removeEventListener('scroll', place, true);
  window.removeEventListener('resize', place);
}

onBeforeUnmount(hide);
</script>

<template>
  <button
    ref="trigger"
    type="button"
    class="prov"
    :aria-describedby="tooltipId"
    @mouseenter="show"
    @mouseleave="hide"
    @focus="show"
    @blur="hide"
    @keydown.escape="hide"
  >
    <span :class="{ data: mono }">{{ value }}</span>
    <sup class="prov__mark" aria-hidden="true">{{ index }}</sup>
    <span
      :id="tooltipId"
      ref="tooltip"
      class="prov__src"
      :class="{ 'prov__src--open': open }"
      role="tooltip"
      :style="{ top: `${position.top}px`, left: `${position.left}px` }"
    >
      <strong>{{
        confirmed ? 'Extraído por IA · confirmado por humano' : 'Extraído por IA · não confirmado'
      }}</strong>
      <span v-for="line in sourceLines" :key="line">{{ line }}</span>
    </span>
  </button>
</template>

<style scoped>
.prov {
  position: relative;
  display: inline;
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  padding: 0;
  cursor: help;
  text-align: left;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.22em;
  text-decoration-color: var(--ink);
}

.prov__mark {
  font-family: var(--mono);
  font-size: 0.62em;
  color: var(--ink);
  margin-left: 0.12em;
  line-height: 1;
}

.prov__src {
  position: fixed;
  z-index: 60;
  width: max-content;
  max-width: min(21rem, calc(100vw - 1.5rem));
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-left: 2px solid var(--ink);
  border-radius: var(--radius-sm);
  padding: 0.55rem 0.7rem;
  font-family: var(--mono);
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--text-2);
  text-decoration: none;
  white-space: normal;
  box-shadow: var(--shadow);
  opacity: 0;
  visibility: hidden;
  transform: translateY(-3px);
  transition:
    opacity 120ms ease,
    transform 120ms ease,
    visibility 120ms;
}

.prov__src--open {
  opacity: 1;
  visibility: visible;
  transform: none;
}

.prov__src strong {
  color: var(--text);
  font-weight: 600;
}

@media (prefers-reduced-motion: reduce) {
  .prov__src {
    transition: none;
    transform: none;
  }
}
</style>
