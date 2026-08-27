<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { ApiError, request } from '../api/client.js';
import type { ProcessingCostSummary } from '../api/types.js';
import { humanizeCode } from '../domain/vocabulary.js';

/**
 * Quanto o escritório gastou com preparo de documentos.
 *
 * O teto que o sistema sempre teve é por caso. Um escritório com trezentos casos ativos não
 * tinha teto nenhum de fato: cada caso respeitava o seu e a conta chegava inteira no fim do mês
 * sem ninguém ter visto crescer. Esta tela é o número que faltava.
 */

const RECORTES = [
  ['provider', 'Provedor'],
  ['model', 'Modelo'],
  ['jobType', 'Etapa'],
  ['case', 'Caso'],
] as const;

type Recorte = (typeof RECORTES)[number][0];

/** Data local no formato que o input date usa, sem passar por fuso. */
function comoData(valor: Date): string {
  return `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, '0')}-${String(valor.getDate()).padStart(2, '0')}`;
}

const hoje = new Date();
const primeiroDoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

const de = ref(comoData(primeiroDoMes));
const ate = ref(comoData(hoje));
const recorte = ref<Recorte>('provider');
const resumo = ref<ProcessingCostSummary | null>(null);
const loading = ref(true);
const failure = ref<ApiError | null>(null);

const moeda = computed(
  () =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: resumo.value?.currency ?? 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
);

/** A maior fatia, para as barras terem escala comparável entre si. */
const maiorFatia = computed(() =>
  Math.max(...(resumo.value?.buckets ?? []).map((b) => Number(b.amount)), 0),
);

const totalNumerico = computed(() => Number(resumo.value?.total ?? '0'));

function proporcao(valor: string): number {
  return maiorFatia.value === 0 ? 0 : (Number(valor) / maiorFatia.value) * 100;
}

/** O rótulo do recorte. Caso vem como identificador e não tem nome legível aqui. */
function rotuloDe(chave: string | null): string {
  if (chave === null) {
    return 'Sem registro';
  }
  return recorte.value === 'case' ? chave : humanizeCode(chave);
}

async function load(): Promise<void> {
  loading.value = true;
  failure.value = null;
  try {
    // O fim é exclusivo na API: somar um dia faz o dia escolhido entrar inteiro.
    const fim = new Date(`${ate.value}T00:00:00`);
    fim.setDate(fim.getDate() + 1);
    resumo.value = await request<ProcessingCostSummary>('/processing-costs', {
      query: {
        from: new Date(`${de.value}T00:00:00`).toISOString(),
        to: fim.toISOString(),
        groupBy: recorte.value,
      },
    });
  } catch (error) {
    failure.value =
      error instanceof ApiError
        ? error
        : new ApiError({
            statusCode: 0,
            code: 'UNEXPECTED',
            message: 'Não foi possível carregar os custos.',
          });
  } finally {
    loading.value = false;
  }
}

function trocarRecorte(valor: Recorte): void {
  recorte.value = valor;
  void load();
}

onMounted(load);
</script>

<template>
  <section aria-labelledby="costs-title">
    <header class="head">
      <div>
        <p class="label">Supervisão</p>
        <h1 id="costs-title">Custo de preparo</h1>
        <p class="muted head__lede">
          O que o escritório gastou preparando documentos no período. O teto por caso continua
          valendo caso a caso; este é o total que ele não enxerga.
        </p>
      </div>
    </header>

    <form class="filters" @submit.prevent="load()">
      <label class="field">
        <span class="label">De</span>
        <input v-model="de" type="date" :max="ate" />
      </label>
      <label class="field">
        <span class="label">Até</span>
        <input v-model="ate" type="date" :min="de" />
      </label>
      <button class="btn btn--ghost" type="submit" :disabled="loading">Aplicar período</button>
    </form>

    <div v-if="loading" class="panel" aria-busy="true">
      <p class="visually-hidden">Carregando os custos.</p>
      <div v-for="row in 4" :key="row" class="skeleton-row">
        <span class="skeleton" style="width: 40%" />
      </div>
    </div>

    <div v-else-if="failure" class="state state--error" role="alert">
      <h2 class="state__title">Não foi possível carregar os custos</h2>
      <p class="state__body">{{ failure.message }}</p>
      <p v-if="failure.requestId" class="state__ref data">
        Referência para o suporte: {{ failure.requestId }}
      </p>
      <button class="btn" type="button" @click="load()">Tentar novamente</button>
    </div>

    <template v-else-if="resumo">
      <div class="total" role="status">
        <p class="label">Total do escritório no período</p>
        <p class="total__valor data">{{ moeda.format(totalNumerico) }}</p>
        <p class="muted total__nota">
          {{ resumo.executions }}
          {{ resumo.executions === 1 ? 'execução concluída' : 'execuções concluídas' }}. Trabalho
          reservado e ainda não concluído não entra: ele não é despesa até terminar.
        </p>
      </div>

      <div class="recortes" role="tablist" aria-label="Abrir o total por">
        <button
          v-for="[valor, rotulo] in RECORTES"
          :key="valor"
          class="recorte"
          type="button"
          role="tab"
          :aria-selected="recorte === valor"
          @click="trocarRecorte(valor)"
        >
          {{ rotulo }}
        </button>
      </div>

      <div v-if="resumo.buckets.length === 0" class="empty">
        <p class="empty__b">
          Nenhuma execução concluída com custo no período. Se você esperava ver alguma coisa aqui,
          confira o período — ou a preparação ainda não terminou.
        </p>
      </div>

      <ul v-else class="fatias">
        <li v-for="fatia in resumo.buckets" :key="fatia.key ?? 'sem-registro'" class="fatia">
          <div class="fatia__topo">
            <span class="fatia__nome">{{ rotuloDe(fatia.key) }}</span>
            <span class="fatia__valor data">{{ moeda.format(Number(fatia.amount)) }}</span>
          </div>
          <!-- A barra dá a proporção de relance; o número continua sendo a fonte. -->
          <div class="fatia__barra" aria-hidden="true">
            <span class="fatia__preenchida" :style="{ width: `${proporcao(fatia.amount)}%` }" />
          </div>
          <p class="fatia__nota muted">
            {{ fatia.executions }}
            {{ fatia.executions === 1 ? 'execução' : 'execuções' }}
          </p>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.total {
  padding: var(--space-4);
  margin-bottom: var(--space-4);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
}

.total__valor {
  margin: var(--space-2) 0 var(--space-2);
  font-size: 2.1rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

.total__nota {
  margin: 0;
  font-size: 0.85rem;
  max-width: 46rem;
  line-height: 1.5;
}

.recortes {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
}

.recorte {
  font: inherit;
  font-size: 0.85rem;
  padding: var(--space-2) var(--space-3);
  background: none;
  color: var(--text-2);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  cursor: pointer;
}

.recorte[aria-selected='true'] {
  color: var(--text);
  border-color: var(--line-strong);
  background: var(--surface-sunk);
  font-weight: 600;
}

.fatias {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.fatia {
  padding: var(--space-3) var(--space-4);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}

.fatia__topo {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-4);
}

.fatia__nome {
  font-weight: 500;
}

.fatia__valor {
  font-variant-numeric: tabular-nums;
}

.fatia__barra {
  height: 4px;
  margin: var(--space-2) 0 var(--space-2);
  background: var(--surface-sunk);
  border-radius: 2px;
  overflow: hidden;
}

.fatia__preenchida {
  display: block;
  height: 100%;
  background: var(--ink);
  border-radius: 2px;
}

.fatia__nota {
  margin: 0;
  font-size: 0.78rem;
}
</style>
