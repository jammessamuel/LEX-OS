<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ApiError, request } from '../api/client.js';
import { personTypes, type Person, type PersonType } from '../api/types.js';
import { personTypeLabels } from '../domain/vocabulary.js';

const route = useRoute();
const router = useRouter();
const personId = computed(() => (typeof route.params.id === 'string' ? route.params.id : null));
const editing = computed(() => personId.value !== null);

const form = reactive({
  personType: 'INDIVIDUAL' as PersonType,
  fullName: '',
  tradeName: '',
  cpf: '',
  cnpj: '',
  rg: '',
  birthDate: '',
  email: '',
  phone: '',
  occupation: '',
  maritalStatus: '',
});

/**
 * A API devolve CPF, CNPJ e RG mascarados e não aceita a máscara de volta. Na edição os
 * campos começam vazios, a máscara vira dica, e só o que for digitado entra no envio.
 */
const maskedDocuments = reactive({ cpf: '', cnpj: '', rg: '' });

const loading = ref(editing.value);
const saving = ref(false);
const failure = ref<ApiError | null>(null);

function apiError(error: unknown, message: string): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError({ statusCode: 0, code: 'UNEXPECTED', message });
}

function fill(person: Person): void {
  form.personType = person.personType;
  form.fullName = person.fullName;
  form.tradeName = person.tradeName ?? '';
  form.birthDate = person.birthDate?.slice(0, 10) ?? '';
  form.email = person.email ?? '';
  form.phone = person.phone ?? '';
  form.occupation = person.occupation ?? '';
  form.maritalStatus = person.maritalStatus ?? '';
  maskedDocuments.cpf = person.cpf ?? '';
  maskedDocuments.cnpj = person.cnpj ?? '';
  maskedDocuments.rg = person.rg ?? '';
}

async function load(): Promise<void> {
  if (personId.value === null) {
    return;
  }
  failure.value = null;
  try {
    fill(await request<Person>(`/persons/${personId.value}`));
  } catch (error) {
    failure.value = apiError(error, 'Não foi possível carregar a pessoa.');
  } finally {
    loading.value = false;
  }
}

async function save(): Promise<void> {
  saving.value = true;
  failure.value = null;
  try {
    const body = {
      personType: form.personType,
      fullName: form.fullName.trim(),
      tradeName: form.tradeName.trim() || null,
      birthDate: form.birthDate || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      occupation: form.occupation.trim() || null,
      maritalStatus: form.maritalStatus.trim() || null,
      // Documento só entra no envio quando digitado; omitir preserva o valor guardado.
      ...(form.cpf.trim() === '' ? {} : { cpf: form.cpf.trim() }),
      ...(form.cnpj.trim() === '' ? {} : { cnpj: form.cnpj.trim() }),
      ...(form.rg.trim() === '' ? {} : { rg: form.rg.trim() }),
    };
    const saved = await request<Person>(
      personId.value === null ? '/persons' : `/persons/${personId.value}`,
      { method: personId.value === null ? 'POST' : 'PATCH', body },
    );
    await router.replace({ name: 'person-detail', params: { id: saved.id } });
  } catch (error) {
    failure.value = apiError(error, 'Não foi possível salvar a pessoa.');
  } finally {
    saving.value = false;
  }
}

onMounted(() => void load());
</script>

<template>
  <section aria-labelledby="person-form-title">
    <p class="crumb">
      <RouterLink :to="{ name: 'persons' }">Pessoas</RouterLink>
      <span aria-hidden="true">/</span>
      <span>{{ editing ? 'Editar' : 'Nova' }}</span>
    </p>

    <header class="head">
      <div>
        <p class="label">Cadastro</p>
        <h1 id="person-form-title">{{ editing ? 'Editar pessoa' : 'Cadastrar pessoa' }}</h1>
        <p class="muted">
          Dados cadastrais. O vínculo com casos é feito na tela do caso, em Partes.
        </p>
      </div>
    </header>

    <div v-if="loading" class="panel form-loading" aria-busy="true">
      <p class="visually-hidden">Carregando o formulário.</p>
      <span v-for="row in 6" :key="row" class="skeleton" />
    </div>

    <form v-else class="panel person-form" @submit.prevent="save">
      <div v-if="failure" class="form-error" role="alert">
        <strong>{{ failure.message }}</strong>
        <span v-if="failure.requestId" class="data">Referência: {{ failure.requestId }}</span>
      </div>

      <div class="form-grid">
        <label class="field">
          <span class="label">Tipo de pessoa</span>
          <select v-model="form.personType">
            <option v-for="type in personTypes" :key="type" :value="type">
              {{ personTypeLabels[type] }}
            </option>
          </select>
        </label>
        <label class="field field--wide">
          <span class="label">Nome completo</span>
          <input v-model="form.fullName" required minlength="2" maxlength="255" />
          <span v-if="failure?.detailFor('fullName')" class="field__error">
            {{ failure.detailFor('fullName') }}
          </span>
        </label>
        <label class="field field--wide">
          <span class="label">Nome fantasia</span>
          <input v-model="form.tradeName" maxlength="255" />
          <span class="field__hint">Somente para pessoa jurídica com nome de fachada.</span>
        </label>
        <label class="field">
          <span class="label">CPF</span>
          <input
            v-model="form.cpf"
            inputmode="numeric"
            autocomplete="off"
            :placeholder="maskedDocuments.cpf || ''"
          />
          <span v-if="failure?.detailFor('cpf')" class="field__error">
            {{ failure.detailFor('cpf') }}
          </span>
          <span v-else-if="editing && maskedDocuments.cpf" class="field__hint">
            Já cadastrado. Preencha somente para substituir.
          </span>
        </label>
        <label class="field">
          <span class="label">CNPJ</span>
          <input
            v-model="form.cnpj"
            inputmode="numeric"
            autocomplete="off"
            :placeholder="maskedDocuments.cnpj || ''"
          />
          <span v-if="failure?.detailFor('cnpj')" class="field__error">
            {{ failure.detailFor('cnpj') }}
          </span>
          <span v-else-if="editing && maskedDocuments.cnpj" class="field__hint">
            Já cadastrado. Preencha somente para substituir.
          </span>
        </label>
        <label class="field">
          <span class="label">RG</span>
          <input
            v-model="form.rg"
            maxlength="32"
            autocomplete="off"
            :placeholder="maskedDocuments.rg || ''"
          />
          <span v-if="editing && maskedDocuments.rg" class="field__hint">
            Já cadastrado. Preencha somente para substituir.
          </span>
        </label>
        <label class="field">
          <span class="label">Nascimento</span>
          <input v-model="form.birthDate" type="date" />
        </label>
        <label class="field">
          <span class="label">E-mail</span>
          <input v-model="form.email" type="email" maxlength="320" />
          <span v-if="failure?.detailFor('email')" class="field__error">
            {{ failure.detailFor('email') }}
          </span>
        </label>
        <label class="field">
          <span class="label">Telefone</span>
          <input v-model="form.phone" maxlength="32" />
        </label>
        <label class="field">
          <span class="label">Ocupação</span>
          <input v-model="form.occupation" maxlength="120" />
        </label>
        <label class="field">
          <span class="label">Estado civil</span>
          <input v-model="form.maritalStatus" maxlength="80" />
        </label>
      </div>

      <div class="form-actions">
        <RouterLink
          class="btn btn--ghost"
          :to="personId ? { name: 'person-detail', params: { id: personId } } : { name: 'persons' }"
        >
          Cancelar
        </RouterLink>
        <button class="btn" type="submit" :disabled="saving">
          {{ saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Cadastrar pessoa' }}
        </button>
      </div>
    </form>
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
  margin-bottom: var(--space-5);
}

.head .muted {
  margin-top: var(--space-2);
}

.panel {
  max-width: 64rem;
  padding: var(--space-5);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
}

.form-loading {
  display: grid;
  gap: var(--space-4);
}

.form-loading .skeleton {
  height: 2.5rem;
}

.form-error {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-bottom: var(--space-4);
  padding: var(--space-3);
  border: 1px solid color-mix(in oklab, var(--rejeitado) 35%, var(--line));
  border-radius: var(--radius);
  color: var(--rejeitado);
  background: var(--rejeitado-bg);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.field--wide {
  grid-column: 1 / -1;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-5);
}

@media (max-width: 42rem) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .field--wide {
    grid-column: auto;
  }
}
</style>
