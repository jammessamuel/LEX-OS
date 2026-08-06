<script setup lang="ts">
/**
 * Marcador de estado.
 *
 * Sigilo nunca é comunicado só por cor: o tom "sigilo" também troca o marcador por uma
 * hachura e sempre acompanha rótulo textual, porque a consequência de errar é vazar
 * informação sigilosa e daltonismo não pode ser a causa.
 */
withDefaults(
  defineProps<{
    label: string;
    tone?: 'neutro' | 'pendente' | 'confirmado' | 'rejeitado' | 'sigilo';
  }>(),
  { tone: 'neutro' },
);
</script>

<template>
  <span class="chip" :class="`chip--${tone}`">
    <span class="chip__mark" aria-hidden="true" />
    {{ label }}
  </span>
</template>

<style scoped>
.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  padding: 0.1rem 0.45rem 0.14rem;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  white-space: nowrap;
}

.chip__mark {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background: currentColor;
  flex: none;
}

.chip--neutro {
  color: var(--text-2);
  background: var(--surface-sunk);
  border-color: var(--line);
}

.chip--pendente {
  color: var(--pendente);
  background: var(--pendente-bg);
  border-color: color-mix(in oklab, var(--pendente) 26%, transparent);
}

.chip--confirmado {
  color: var(--confirmado);
  background: var(--confirmado-bg);
  border-color: color-mix(in oklab, var(--confirmado) 26%, transparent);
}

.chip--rejeitado {
  color: var(--rejeitado);
  background: var(--rejeitado-bg);
  border-color: color-mix(in oklab, var(--rejeitado) 26%, transparent);
}

.chip--sigilo {
  color: var(--sigilo);
  background: var(--sigilo-bg);
  border-color: color-mix(in oklab, var(--sigilo) 32%, transparent);
}

/* Hachura em vez de ponto: o sigilo se distingue sem depender de percepção de cor. */
.chip--sigilo .chip__mark {
  border-radius: 0;
  width: 0.32rem;
  height: 0.6rem;
  background: repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 4px);
}
</style>
