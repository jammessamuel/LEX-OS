<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { ApiError, request } from '../api/client.js';
import type { Agenda, AgendaTask } from '../api/types.js';
import StatusChip from '../components/StatusChip.vue';
import { priorityLabels, taskStatusLabels } from '../domain/vocabulary.js';
import { useSessionStore } from '../stores/session.js';

const session = useSessionStore();
const agenda = ref<Agenda | null>(null);
const loading = ref(true);
const failure = ref<ApiError | null>(null);

/** Janelas que um escritório realmente usa: hoje, a semana, a quinzena, o mês. */
const windows = [
  { days: 1, label: 'Hoje' },
  { days: 7, label: '7 dias' },
  { days: 15, label: '15 dias' },
  { days: 30, label: '30 dias' },
] as const;

const windowDays = ref<(typeof windows)[number]['days']>(7);
const onlyMine = ref(false);

/**
 * A janela começa à meia-noite do fuso de quem está olhando.
 *
 * Quem decide o fuso é o navegador: o servidor guarda tudo em UTC e não tem como saber onde
 * fica o escritório. Começar "agora" esconderia o que vence hoje mais cedo, que é justamente
 * o prazo que ainda dá para cumprir.
 */
function windowBounds(days: number): { from: string; to: string } {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + days);
  to.setMilliseconds(-1);
  return { from: from.toISOString(), to: to.toISOString() };
}

async function load(): Promise<void> {
  loading.value = true;
  failure.value = null;
  try {
    agenda.value = await request<Agenda>('/agenda', {
      query: {
        ...windowBounds(windowDays.value),
        ...(onlyMine.value ? { scope: 'mine' } : {}),
      },
    });
  } catch (error) {
    agenda.value = null;
    failure.value =
      error instanceof ApiError
        ? error
        : new ApiError({
            statusCode: 0,
            code: 'UNEXPECTED',
            message: 'Não foi possível carregar a agenda.',
          });
  } finally {
    loading.value = false;
  }
}

function chooseWindow(days: (typeof windows)[number]['days']): void {
  windowDays.value = days;
  void load();
}

function toggleMine(): void {
  onlyMine.value = !onlyMine.value;
  void load();
}

const dayHeading = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
});
const clock = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

function dayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * "Hoje" e "Amanhã" por extenso, porque é assim que se fala de prazo.
 *
 * A comparação é por dia do calendário local, não por diferença de horas: um prazo às 23h de
 * hoje e outro às 1h de amanhã distam duas horas e são dias diferentes para quem cumpre.
 */
function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - midnight.getTime()) /
      86_400_000,
  );
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Amanhã';
  return dayHeading.format(date);
}

/** Meia-noite exata é "sem hora marcada"; qualquer outro horário é informação real. */
function timeLabel(iso: string): string | null {
  const date = new Date(iso);
  return date.getHours() === 0 && date.getMinutes() === 0 ? null : clock.format(date);
}

interface AgendaDay {
  key: string;
  label: string;
  date: string;
  tasks: AgendaTask[];
}

/** O agrupamento por dia é feito aqui porque só o navegador conhece o fuso de quem lê. */
const days = computed<AgendaDay[]>(() => {
  const grouped = new Map<string, AgendaDay>();
  for (const task of agenda.value?.upcoming.tasks ?? []) {
    if (task.dueAt === null) continue;
    const key = dayKey(task.dueAt);
    const day = grouped.get(key);
    if (day === undefined) {
      grouped.set(key, { key, label: dayLabel(task.dueAt), date: task.dueAt, tasks: [task] });
    } else {
      day.tasks.push(task);
    }
  }
  return [...grouped.values()];
});

const overdue = computed(() => agenda.value?.overdue ?? null);

/** Quantos dias um prazo já passou — o número que decide a ordem das ligações da manhã. */
function daysLate(iso: string): number {
  const due = new Date(iso);
  const today = new Date();
  return Math.max(
    1,
    Math.round(
      (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
        new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime()) /
        86_400_000,
    ),
  );
}

function priorityTone(task: AgendaTask): 'rejeitado' | 'pendente' | 'neutro' {
  if (task.priority === 'URGENT') return 'rejeitado';
  if (task.priority === 'HIGH') return 'pendente';
  return 'neutro';
}

onMounted(() => {
  void load();
});
</script>

<template>
  <section aria-labelledby="agenda-title">
    <header class="head">
      <div>
        <h1 id="agenda-title">Agenda</h1>
        <p class="muted head__lede">
          Prazos e providências do escritório, do mais próximo ao mais distante.
        </p>
      </div>
    </header>

    <div class="agenda-controls">
      <div class="agenda-windows" role="group" aria-label="Período da agenda">
        <button
          v-for="option in windows"
          :key="option.days"
          class="agenda-window"
          type="button"
          :class="{ 'agenda-window--on': windowDays === option.days }"
          :aria-pressed="windowDays === option.days"
          @click="chooseWindow(option.days)"
        >
          {{ option.label }}
        </button>
      </div>
      <button class="btn btn--ghost" type="button" :aria-pressed="onlyMine" @click="toggleMine">
        {{ onlyMine ? 'Vendo só os meus' : 'Ver só os meus' }}
      </button>
    </div>

    <div v-if="loading" class="panel" aria-busy="true">
      <p class="visually-hidden">Carregando a agenda.</p>
      <div v-for="row in 5" :key="row" class="skeleton-row">
        <span class="skeleton" style="width: 12%" />
        <span class="skeleton" style="width: 48%" />
        <span class="skeleton" style="width: 18%" />
      </div>
    </div>

    <div v-else-if="failure" class="state state--error" role="alert">
      <h2 class="state__title">Não foi possível carregar a agenda</h2>
      <p class="state__body">{{ failure.message }}</p>
      <p v-if="failure.requestId" class="state__ref data">
        Referência para o suporte: {{ failure.requestId }}
      </p>
      <button class="btn" type="button" @click="load()">Tentar novamente</button>
    </div>

    <template v-else-if="agenda">
      <!-- O atrasado vem antes de tudo. É a única coisa nesta tela que não pode esperar. -->
      <div v-if="overdue && overdue.total > 0" class="verdict verdict--alert" role="status">
        <strong>
          {{ overdue.total }}
          {{ overdue.total === 1 ? 'prazo vencido' : 'prazos vencidos' }}
        </strong>
        aguardando providência.
      </div>

      <div v-if="overdue && overdue.tasks.length > 0" class="panel panel--late">
        <div class="panel__bar">
          <span class="label">Vencidos</span>
          <span v-if="overdue.truncated" class="data panel__count">
            mostrando {{ overdue.tasks.length }} de {{ overdue.total }}
          </span>
        </div>
        <ul class="agenda-list">
          <li v-for="task in overdue.tasks" :key="task.id" class="agenda-item">
            <span class="agenda-item__when agenda-item__when--late data">
              {{ daysLate(task.dueAt ?? '') }}
              {{ daysLate(task.dueAt ?? '') === 1 ? 'dia' : 'dias' }}
            </span>
            <div class="agenda-item__body">
              <p class="agenda-item__title">{{ task.title }}</p>
              <p v-if="task.case" class="agenda-item__case muted">
                <RouterLink
                  class="rows__link data"
                  :to="{ name: 'case-detail', params: { id: task.case.id } }"
                >
                  {{ task.case.cnjNumber ?? task.case.internalCode }}
                </RouterLink>
                <span>{{ task.case.title }}</span>
              </p>
            </div>
            <div class="agenda-item__marks">
              <StatusChip :label="priorityLabels[task.priority]" :tone="priorityTone(task)" />
              <StatusChip :label="taskStatusLabels[task.status]" />
              <span v-if="task.assignedTo" class="muted agenda-item__who">
                {{ task.assignedTo.name }}
              </span>
            </div>
          </li>
        </ul>
      </div>

      <div v-if="days.length === 0" class="state">
        <h2 class="state__title">Nada vence neste período</h2>
        <p class="state__body">
          Prazos com data aparecem aqui, agrupados por dia. Tarefas sem data continuam na tela do
          caso.
        </p>
      </div>

      <div v-for="day in days" :key="day.key" class="panel agenda-day">
        <div class="panel__bar">
          <span class="label agenda-day__label">{{ day.label }}</span>
          <span class="data panel__count">
            {{ day.tasks.length }}
            {{ day.tasks.length === 1 ? 'prazo' : 'prazos' }}
          </span>
        </div>
        <ul class="agenda-list">
          <li v-for="task in day.tasks" :key="task.id" class="agenda-item">
            <span class="agenda-item__when data">
              {{ timeLabel(task.dueAt ?? '') ?? '—' }}
            </span>
            <div class="agenda-item__body">
              <p class="agenda-item__title">{{ task.title }}</p>
              <p v-if="task.case" class="agenda-item__case muted">
                <RouterLink
                  class="rows__link data"
                  :to="{ name: 'case-detail', params: { id: task.case.id } }"
                >
                  {{ task.case.cnjNumber ?? task.case.internalCode }}
                </RouterLink>
                <span>{{ task.case.title }}</span>
              </p>
              <p v-else class="agenda-item__case muted">Tarefa do escritório</p>
            </div>
            <div class="agenda-item__marks">
              <StatusChip :label="priorityLabels[task.priority]" :tone="priorityTone(task)" />
              <StatusChip :label="taskStatusLabels[task.status]" />
              <span v-if="task.assignedTo" class="muted agenda-item__who">
                {{ task.assignedTo.name }}
              </span>
            </div>
          </li>
        </ul>
      </div>

      <p v-if="agenda.upcoming.truncated" class="note">
        Mostrando {{ agenda.upcoming.tasks.length }} de {{ agenda.upcoming.total }} prazos do
        período. Reduza a janela para ver o restante.
      </p>

      <p v-if="!session.can('tasks.manage')" class="note">
        Você vê a agenda, mas alterar um prazo exige permissão de gestão de tarefas.
      </p>
    </template>
  </section>
</template>

<style scoped>
.agenda-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}

/* Segmentos de período: um controle só, não quatro botões soltos. */
.agenda-windows {
  display: inline-flex;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
}

.agenda-window {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--text-2);
  font: inherit;
  font-size: var(--step--1);
  padding: var(--space-2) var(--space-4);
  cursor: pointer;
}

.agenda-window + .agenda-window {
  border-inline-start: 1px solid var(--line);
}

.agenda-window:hover {
  background: var(--surface-sunk);
  color: var(--text);
}

.agenda-window--on {
  background: var(--surface-raised);
  color: var(--text);
  font-weight: 600;
}

.panel--late {
  border-color: color-mix(in oklab, var(--rejeitado) 30%, var(--line));
}

.agenda-day + .agenda-day,
.panel--late + .agenda-day {
  margin-top: var(--space-4);
}

.agenda-day__label {
  /* O dia é o cabeçalho da lista, então tem peso de título e não de rótulo de coluna. */
  text-transform: none;
  letter-spacing: 0;
  font-size: var(--step-0);
  color: var(--text);
  font-weight: 650;
}

.agenda-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.agenda-item {
  display: grid;
  grid-template-columns: 5.5rem 1fr auto;
  align-items: start;
  gap: var(--space-4);
  padding: var(--space-4);
  border-top: 1px solid var(--line);
}

.agenda-item__when {
  font-variant-numeric: tabular-nums;
  color: var(--text-2);
  padding-top: 0.1rem;
}

.agenda-item__when--late {
  color: var(--rejeitado);
  font-weight: 600;
}

.agenda-item__body {
  min-width: 0;
}

.agenda-item__title {
  margin: 0;
  color: var(--text);
}

.agenda-item__case {
  margin: var(--space-1) 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
  font-size: var(--step--1);
}

.agenda-item__marks {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
}

.agenda-item__who {
  font-size: var(--step--1);
}

@media (max-width: 46rem) {
  .agenda-item {
    grid-template-columns: 1fr;
    gap: var(--space-2);
  }

  .agenda-item__marks {
    justify-content: flex-start;
  }
}

.skeleton-row {
  display: flex;
  gap: var(--space-4);
  align-items: center;
  padding: var(--space-4);
  border-top: 1px solid var(--line);
}

.skeleton-row:first-child {
  border-top: 0;
}

.skeleton {
  height: 0.6rem;
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
