<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ApiError, request, type NoContent } from '../api/client.js';
import type { CursorPage, Person, PersonCase } from '../api/types.js';
import StatusChip from '../components/StatusChip.vue';
import {
  caseStatusLabels,
  formatDate,
  participantRoleLabels,
  participantSideLabels,
  personTypeLabels,
} from '../domain/vocabulary.js';
import { useSessionStore } from '../stores/session.js';

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const personId = String(route.params.id);

const person = ref<Person | null>(null);
const cases = ref<PersonCase[]>([]);
const casesCursor = ref<string | null>(null);
const loading = ref(true);
const loadingCases = ref(false);
const failure = ref<ApiError | null>(null);
const casesFailure = ref<ApiError | null>(null);

const confirmingRemoval = ref(false);
const removing = ref(false);
const removalFailure = ref<ApiError | null>(null);

function toApiError(error: unknown, fallback: string): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError({ statusCode: 0, code: 'UNEXPECTED', message: fallback });
}

async function loadCases(cursor?: string): Promise<void> {
  loadingCases.value = true;
  casesFailure.value = null;
  try {
    const page = await request<CursorPage<PersonCase>>(`/persons/${personId}/cases`, {
      query: { limit: 25, ...(cursor === undefined ? {} : { cursor }) },
    });
    cases.value = cursor === undefined ? page.data : [...cases.value, ...page.data];
    casesCursor.value = page.pageInfo.hasNextPage ? page.pageInfo.nextCursor : null;
  } catch (error) {
    casesFailure.value = toApiError(error, 'Não foi possível carregar os casos desta pessoa.');
  } finally {
    loadingCases.value = false;
  }
}

async function load(): Promise<void> {
  loading.value = true;
  failure.value = null;
  try {
    person.value = await request<Person>(`/persons/${personId}`);
  } catch (error) {
    failure.value = toApiError(error, 'Não foi possível carregar a pessoa.');
    loading.value = false;
    return;
  }
  loading.value = false;
  // Os casos carregam depois dos dados: falha aqui não derruba a ficha.
  void loadCases();
}

async function remove(): Promise<void> {
  removing.value = true;
  removalFailure.value = null;
  try {
    await request<NoContent>(`/persons/${personId}`, { method: 'DELETE' });
    await router.replace({ name: 'persons' });
  } catch (error) {
    removalFailure.value = toApiError(error, 'Não foi possível excluir a pessoa.');
    confirmingRemoval.value = false;
  } finally {
    removing.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <section aria-labelledby="person-title">
    <p class="crumb">
      <RouterLink :to="{ name: 'persons' }">Pessoas</RouterLink>
      <span aria-hidden="true">/</span>
      <span>{{ person?.fullName ?? 'pessoa' }}</span>
    </p>

    <div v-if="loading" class="panel form-loading" aria-busy="true">
      <p class="visually-hidden">Carregando a pessoa.</p>
      <span v-for="row in 5" :key="row" class="skeleton" />
    </div>

    <div v-else-if="failure" class="state state--error" role="alert">
      <h2 class="state__title">Não foi possível carregar a pessoa</h2>
      <p class="state__body">{{ failure.message }}</p>
      <p v-if="failure.requestId" class="state__ref data">
        Referência para o suporte: {{ failure.requestId }}
      </p>
      <button class="btn" type="button" @click="load()">Tentar novamente</button>
    </div>

    <template v-else-if="person">
      <header class="head">
        <div>
          <p class="label">{{ personTypeLabels[person.personType] }}</p>
          <h1 id="person-title">{{ person.fullName }}</h1>
          <p v-if="person.tradeName" class="muted">{{ person.tradeName }}</p>
        </div>
        <div class="head__actions">
          <RouterLink
            v-if="session.can('persons.manage')"
            class="btn btn--ghost"
            :to="{ name: 'person-edit', params: { id: person.id } }"
          >
            Editar
          </RouterLink>
          <button
            v-if="session.can('persons.manage') && !confirmingRemoval"
            class="btn btn--ghost btn--danger"
            type="button"
            @click="confirmingRemoval = true"
          >
            Excluir
          </button>
        </div>
      </header>

      <div
        v-if="confirmingRemoval"
        class="removal"
        role="alertdialog"
        aria-label="Confirmar exclusão"
      >
        <p class="removal__body">
          Excluir esta pessoa a remove das listas do escritório. Os casos em que ela participa não
          são alterados.
        </p>
        <div class="removal__actions">
          <button
            class="btn btn--ghost"
            type="button"
            :disabled="removing"
            @click="confirmingRemoval = false"
          >
            Cancelar
          </button>
          <button
            class="btn btn--danger-solid"
            type="button"
            :disabled="removing"
            @click="remove()"
          >
            {{ removing ? 'Excluindo…' : 'Confirmar exclusão' }}
          </button>
        </div>
      </div>

      <p v-if="removalFailure" class="action-failure" role="alert">
        {{ removalFailure.message }}
        <span v-if="removalFailure.requestId" class="data">
          Referência: {{ removalFailure.requestId }}
        </span>
      </p>

      <div class="columns">
        <section class="panel" aria-labelledby="person-data-title">
          <div class="panel__bar">
            <h2 id="person-data-title" class="label">Dados cadastrais</h2>
          </div>
          <dl class="facts">
            <div class="fact">
              <dt>CPF</dt>
              <dd class="data" :class="{ muted: person.cpf === null }">{{ person.cpf ?? '—' }}</dd>
            </div>
            <div class="fact">
              <dt>CNPJ</dt>
              <dd class="data" :class="{ muted: person.cnpj === null }">
                {{ person.cnpj ?? '—' }}
              </dd>
            </div>
            <div class="fact">
              <dt>RG</dt>
              <dd class="data" :class="{ muted: person.rg === null }">{{ person.rg ?? '—' }}</dd>
            </div>
            <div class="fact">
              <dt>Nascimento</dt>
              <dd :class="{ muted: person.birthDate === null }">
                {{ person.birthDate ? formatDate(person.birthDate) : '—' }}
              </dd>
            </div>
            <div class="fact">
              <dt>E-mail</dt>
              <dd :class="{ muted: person.email === null }">{{ person.email ?? '—' }}</dd>
            </div>
            <div class="fact">
              <dt>Telefone</dt>
              <dd :class="{ muted: person.phone === null }">{{ person.phone ?? '—' }}</dd>
            </div>
            <div class="fact">
              <dt>Ocupação</dt>
              <dd :class="{ muted: person.occupation === null }">
                {{ person.occupation ?? '—' }}
              </dd>
            </div>
            <div class="fact">
              <dt>Estado civil</dt>
              <dd :class="{ muted: person.maritalStatus === null }">
                {{ person.maritalStatus ?? '—' }}
              </dd>
            </div>
            <div class="fact">
              <dt>Cadastro</dt>
              <dd class="data">{{ formatDate(person.createdAt) }}</dd>
            </div>
          </dl>
        </section>

        <section class="panel" aria-labelledby="person-cases-title">
          <div class="panel__bar">
            <h2 id="person-cases-title" class="label">Participações em casos</h2>
            <span class="data panel__count">{{ cases.length }} carregadas</span>
          </div>

          <div v-if="casesFailure" class="panel-error" role="alert">
            <p>{{ casesFailure.message }}</p>
            <button class="btn btn--ghost" type="button" @click="loadCases()">
              Tentar novamente
            </button>
          </div>

          <p v-else-if="!loadingCases && cases.length === 0" class="panel-empty">
            Esta pessoa ainda não participa de nenhum caso acessível a você. O vínculo é feito na
            tela do caso, em Partes.
          </p>

          <ul v-else class="links">
            <li v-for="entry in cases" :key="entry.case.id" class="links__item">
              <RouterLink
                class="links__case data"
                :to="{ name: 'case-detail', params: { id: entry.case.id } }"
              >
                {{ entry.case.internalCode }}
              </RouterLink>
              <span class="links__title">{{ entry.case.title }}</span>
              <span class="links__roles">
                <template v-for="participation in entry.participations" :key="participation.id">
                  <StatusChip
                    :label="
                      participantRoleLabels[participation.role] +
                      (participation.side ? ' · ' + participantSideLabels[participation.side] : '')
                    "
                    :tone="participation.isClient ? 'confirmado' : 'neutro'"
                  />
                </template>
                <StatusChip :label="caseStatusLabels[entry.case.status]" />
              </span>
            </li>
          </ul>

          <div v-if="casesCursor" class="panel__more">
            <button
              class="btn btn--ghost"
              type="button"
              :disabled="loadingCases"
              @click="loadCases(casesCursor)"
            >
              {{ loadingCases ? 'Carregando…' : 'Carregar mais' }}
            </button>
          </div>
        </section>
      </div>
    </template>
  </section>
</template>

<style scoped>
.crumb {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
  color: var(--text-3);
  font-size: var(--step--1);
}

.crumb a {
  color: var(--text-2);
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

.head .muted {
  margin-top: var(--space-1);
}

.head__actions {
  display: flex;
  gap: var(--space-3);
}

.btn--danger {
  color: var(--rejeitado);
  border-color: color-mix(in oklab, var(--rejeitado) 45%, var(--line-strong));
}

.btn--danger-solid {
  background: var(--rejeitado);
  border-color: var(--rejeitado);
  color: var(--surface);
}

.removal {
  margin-bottom: var(--space-4);
  padding: var(--space-4);
  border: 1px solid color-mix(in oklab, var(--rejeitado) 40%, var(--line));
  border-radius: var(--radius-lg);
  background: var(--surface);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.removal__body {
  color: var(--text-2);
  font-size: var(--step--1);
  max-width: 52ch;
}

.removal__actions {
  display: flex;
  gap: var(--space-3);
}

.action-failure {
  margin-bottom: var(--space-4);
  padding: var(--space-3);
  border: 1px solid color-mix(in oklab, var(--rejeitado) 35%, var(--line));
  border-radius: var(--radius);
  color: var(--rejeitado);
  font-size: var(--step--1);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.columns {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: var(--space-4);
  align-items: start;
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

.panel__more {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--line);
}

.facts {
  margin: 0;
  padding: var(--space-2) 0;
}

.fact {
  display: grid;
  grid-template-columns: 9rem minmax(0, 1fr);
  gap: var(--space-3);
  padding: 0.55rem var(--space-4);
  font-size: var(--step--1);
}

.fact + .fact {
  border-top: 1px solid var(--line);
}

.fact dt {
  color: var(--text-3);
  font-size: 0.73rem;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  align-self: center;
}

.fact dd {
  margin: 0;
}

.panel-error,
.panel-empty {
  padding: var(--space-4);
  font-size: var(--step--1);
  color: var(--text-2);
}

.panel-error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
  color: var(--rejeitado);
}

.links {
  list-style: none;
  margin: 0;
  padding: 0;
}

.links__item {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding: 0.62rem var(--space-4);
  border-bottom: 1px solid var(--line);
  font-size: var(--step--1);
}

.links__item:last-child {
  border-bottom: 0;
}

.links__case {
  color: var(--ink);
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}

.links__case:hover {
  text-decoration: underline;
  text-underline-offset: 0.2em;
}

.links__title {
  font-weight: 600;
  min-width: 12rem;
  flex: 1;
}

.links__roles {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.form-loading {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-5);
}

.form-loading .skeleton {
  height: 2.2rem;
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

@media (max-width: 54rem) {
  .columns {
    grid-template-columns: 1fr;
  }
}

@keyframes sweep {
  to {
    background-position: -220% 0;
  }
}
</style>
