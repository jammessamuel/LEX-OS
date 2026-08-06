<script setup lang="ts">
import { useId } from 'vue';

/**
 * Marcador de procedência em forma de nota de rodapé.
 *
 * Dado extraído por IA aparece com sublinhado pontilhado e numeral sobrescrito, como uma
 * citação em peça impressa. A fonte — arquivo, página, trecho, modelo, confiança — é
 * revelada no hover e no foco de teclado, nunca escondida atrás de clique. Sóbrio de
 * propósito: o advogado precisa saber, não ser interrompido.
 */
defineProps<{
  /** O valor exibido. */
  value: string;
  /** Numeral da nota na tela (1, 2, 3…). */
  index: number;
  /** Linhas da fonte, já em pt-BR, na ordem de leitura. */
  sourceLines: readonly string[];
  /** Identificador jurídico usa mono e números tabulares. */
  mono?: boolean;
}>();

const tooltipId = useId();
</script>

<template>
  <button type="button" class="prov" :aria-describedby="tooltipId">
    <span :class="{ data: mono }">{{ value }}</span>
    <sup class="prov__mark" aria-hidden="true">{{ index }}</sup>
    <span :id="tooltipId" class="prov__src" role="tooltip">
      <strong>Extraído por IA · não confirmado</strong>
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
  position: absolute;
  left: 0;
  top: calc(100% + 0.5rem);
  z-index: 10;
  width: max-content;
  max-width: 21rem;
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

.prov:hover .prov__src,
.prov:focus-visible .prov__src {
  opacity: 1;
  visibility: visible;
  transform: none;
}

.prov__src strong {
  color: var(--text);
  font-weight: 600;
}
</style>
