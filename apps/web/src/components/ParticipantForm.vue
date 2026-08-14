<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { ApiError, request } from '../api/client.js';
import {
  participantRoles,
  participantSides,
  personTypes,
  type CursorPage,
  type Participant,
  type ParticipantRole,
  type ParticipantSide,
  type Person,
  type PersonType,
} from '../api/types.js';
import { participantRoleLabels, participantSideLabels } from '../domain/vocabulary.js';
import { useSessionStore } from '../stores/session.js';

const props = defineProps<{ caseId: string }>();
const emit = defineEmits<{ created: [participant: Participant]; cancel: [] }>();
const session = useSessionStore();

const persons = ref<Person[]>([]);
const personId = ref('');
const role = ref<ParticipantRole>('autor');
const side = ref<ParticipantSide | ''>('polo_ativo');
const isClient = ref(false);
const creatingPerson = ref(false);
const personType = ref<PersonType>('INDIVIDUAL');
const fullName = ref('');
const tradeName = ref('');
const loading = ref(true);
const saving = ref(false);
const failure = ref<ApiError | null>(null);

const canCreatePerson = computed(() => session.can('persons.manage'));

function toApiError(error: unknown): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError({
        statusCode: 0,
        code: 'UNEXPECTED',
        message: 'Não foi possível associar a pessoa ao caso.',
      });
}

async function loadPersons(): Promise<void> {
  loading.value = true;
  failure.value = null;
  try {
    const page = await request<CursorPage<Person>>('/persons', { query: { limit: 100 } });
    persons.value = page.data;
    if (page.data.length === 0 && canCreatePerson.value) creatingPerson.value = true;
  } catch (error) {
    failure.value = toApiError(error);
  } finally {
    loading.value = false;
  }
}

async function save(): Promise<void> {
  saving.value = true;
  failure.value = null;
  try {
    let selectedPersonId = personId.value;
    if (creatingPerson.value) {
      const person = await request<Person>('/persons', {
        method: 'POST',
        body: {
          personType: personType.value,
          fullName: fullName.value.trim(),
          tradeName: tradeName.value.trim() || null,
        },
      });
      selectedPersonId = person.id;
    }

    const participant = await request<Participant>(`/cases/${props.caseId}/participants`, {
      method: 'POST',
      body: {
        personId: selectedPersonId,
        role: role.value,
        side: side.value || null,
        isClient: isClient.value,
      },
    });
    emit('created', participant);
  } catch (error) {
    failure.value = toApiError(error);
  } finally {
    saving.value = false;
  }
}

onMounted(() => void loadPersons());
</script>

<template>
  <form class="participant-form" @submit.prevent="save">
    <div class="participant-form__bar">
      <strong>Adicionar parte</strong>
      <button class="text-button" type="button" @click="emit('cancel')">Fechar</button>
    </div>

    <div v-if="failure" class="form-error" role="alert">{{ failure.message }}</div>
    <p v-if="loading" aria-busy="true">Carregando pessoas…</p>

    <template v-else>
      <div class="mode" role="group" aria-label="Origem da pessoa">
        <button
          class="btn btn--ghost"
          type="button"
          :aria-pressed="!creatingPerson"
          @click="creatingPerson = false"
        >
          Pessoa cadastrada
        </button>
        <button
          v-if="canCreatePerson"
          class="btn btn--ghost"
          type="button"
          :aria-pressed="creatingPerson"
          @click="creatingPerson = true"
        >
          Nova pessoa
        </button>
      </div>

      <label v-if="!creatingPerson" class="field">
        <span class="label">Pessoa</span>
        <select v-model="personId" required>
          <option value="" disabled>Selecione</option>
          <option v-for="person in persons" :key="person.id" :value="person.id">
            {{ person.tradeName ?? person.fullName }}
          </option>
        </select>
        <span v-if="persons.length === 0" class="field__hint">
          Nenhuma pessoa cadastrada. Peça permissão para cadastrar uma nova.
        </span>
      </label>

      <div v-else class="new-person">
        <label class="field">
          <span class="label">Tipo de pessoa</span>
          <select v-model="personType">
            <option v-for="type in personTypes" :key="type" :value="type">
              {{
                type === 'INDIVIDUAL'
                  ? 'Pessoa física'
                  : type === 'COMPANY'
                    ? 'Empresa'
                    : 'Órgão público'
              }}
            </option>
          </select>
        </label>
        <label class="field">
          <span class="label">Nome completo ou razão social</span>
          <input
            id="participant-person-name"
            v-model="fullName"
            required
            minlength="2"
            maxlength="255"
          />
        </label>
        <label class="field new-person__wide">
          <span class="label">Nome fantasia</span>
          <input v-model="tradeName" maxlength="255" />
        </label>
      </div>

      <div class="participant-fields">
        <label class="field">
          <span class="label">Papel no caso</span>
          <select v-model="role">
            <option v-for="item in participantRoles" :key="item" :value="item">
              {{ participantRoleLabels[item] }}
            </option>
          </select>
        </label>
        <label class="field">
          <span class="label">Polo</span>
          <select v-model="side">
            <option value="">Não informado</option>
            <option v-for="item in participantSides" :key="item" :value="item">
              {{ participantSideLabels[item] }}
            </option>
          </select>
        </label>
      </div>

      <label class="check">
        <input v-model="isClient" type="checkbox" />
        <span>Esta pessoa é cliente do escritório neste caso</span>
      </label>

      <div class="participant-form__actions">
        <button class="btn" type="submit" :disabled="saving || (!creatingPerson && !personId)">
          {{ saving ? 'Associando…' : 'Adicionar ao caso' }}
        </button>
      </div>
    </template>
  </form>
</template>

<style scoped>
.participant-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
  border-bottom: 1px solid var(--line);
  background: var(--surface-sunk);
}

.participant-form__bar,
.participant-form__actions,
.mode {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.text-button {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  cursor: pointer;
}

.mode {
  justify-content: flex-start;
}

.mode [aria-pressed='true'] {
  border-color: var(--ink);
  background: color-mix(in oklab, var(--ink) 10%, transparent);
}

.participant-fields,
.new-person {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.new-person__wide {
  grid-column: 1 / -1;
}

.check {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  font-size: var(--step--1);
}

.form-error {
  padding: var(--space-3);
  border-radius: var(--radius);
  color: var(--rejeitado);
  background: var(--rejeitado-bg);
}

@media (max-width: 36rem) {
  .participant-fields,
  .new-person {
    grid-template-columns: 1fr;
  }

  .new-person__wide {
    grid-column: auto;
  }
}
</style>
