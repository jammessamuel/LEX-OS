<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ApiError, request } from '../api/client.js';

/**
 * Aceite do convite: a primeira tela que uma pessoa nova vê do LEX OS.
 *
 * Ela chega por um link, sem saber o que é o produto e sem sessão. Duas consequências: o
 * texto explica onde ela está antes de pedir qualquer coisa, e a recusa nunca diz *qual* das
 * quatro coisas houve — inexistente, expirado, usado ou revogado — porque a API não distingue
 * e a tela não pode inventar a diferença.
 */

const MIN_PASSWORD = 12;

const route = useRoute();
const router = useRouter();

const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''));
const password = ref('');
const confirmation = ref('');
const submitting = ref(false);
const failure = ref<ApiError | null>(null);
const done = ref(false);

const mismatch = computed(
  () => confirmation.value.length > 0 && confirmation.value !== password.value,
);
const tooShort = computed(() => password.value.length > 0 && password.value.length < MIN_PASSWORD);
const ready = computed(
  () => token.value !== '' && password.value.length >= MIN_PASSWORD && !mismatch.value,
);

async function submit(): Promise<void> {
  submitting.value = true;
  failure.value = null;
  try {
    await request('/auth/invitations/accept', {
      method: 'POST',
      body: { token: token.value, password: password.value },
      skipRefresh: true,
    });
    done.value = true;
    password.value = '';
    confirmation.value = '';
  } catch (error) {
    failure.value =
      error instanceof ApiError
        ? error
        : new ApiError({
            statusCode: 0,
            code: 'UNEXPECTED',
            message: 'Não foi possível concluir. Tente novamente.',
          });
    password.value = '';
    confirmation.value = '';
  } finally {
    submitting.value = false;
  }
}

function goToSignIn(): void {
  void router.replace({ name: 'login' });
}
</script>

<template>
  <main class="accept">
    <section class="accept__panel" aria-labelledby="accept-title">
      <p class="accept__brand">LEX OS</p>

      <template v-if="done">
        <h1 id="accept-title" class="accept__title">Acesso criado</h1>
        <p class="accept__lede">
          Sua senha foi definida e o convite está concluído. A partir de agora você entra pelo nome
          curto do escritório, o seu e-mail e essa senha.
        </p>
        <button class="btn accept__go" type="button" @click="goToSignIn">Ir para a entrada</button>
      </template>

      <!-- Link sem token: quase sempre é cópia parcial. Dizer isso poupa uma tentativa. -->
      <template v-else-if="token === ''">
        <h1 id="accept-title" class="accept__title">Falta o convite no link</h1>
        <p class="accept__lede">
          O endereço aberto não traz o código do convite. Isso costuma acontecer quando o link é
          copiado pela metade. Peça o link completo a quem convidou você.
        </p>
      </template>

      <template v-else>
        <h1 id="accept-title" class="accept__title">Criar seu acesso</h1>
        <p class="accept__lede">
          Você foi convidada ao LEX OS, a plataforma operacional do escritório. Defina uma senha
          para concluir. Este convite vale uma vez só.
        </p>

        <form class="accept__form" novalidate @submit.prevent="submit">
          <div class="field">
            <label class="label" for="password">Senha</label>
            <input
              id="password"
              v-model="password"
              type="password"
              autocomplete="new-password"
              :aria-invalid="tooShort"
              aria-describedby="password-hint"
            />
            <p id="password-hint" class="field__hint">
              Pelo menos {{ MIN_PASSWORD }} caracteres. Você vai usá-la todo dia; prefira uma frase
              que só você saiba a uma sequência difícil de lembrar.
            </p>
          </div>

          <div class="field">
            <label class="label" for="confirmation">Repita a senha</label>
            <input
              id="confirmation"
              v-model="confirmation"
              type="password"
              autocomplete="new-password"
              :aria-invalid="mismatch"
              :aria-describedby="mismatch ? 'confirmation-error' : undefined"
            />
            <p v-if="mismatch" id="confirmation-error" class="field__error">
              As duas senhas estão diferentes.
            </p>
          </div>

          <p v-if="failure" class="accept__error" role="alert">
            {{ failure.message }}
            <span v-if="failure.requestId" class="accept__ref data">
              Referência para o suporte: {{ failure.requestId }}
            </span>
          </p>

          <button class="btn accept__go" type="submit" :disabled="!ready || submitting">
            {{ submitting ? 'Concluindo…' : 'Concluir e criar acesso' }}
          </button>
        </form>
      </template>
    </section>
  </main>
</template>

<style scoped>
.accept {
  min-height: 100%;
  display: grid;
  place-items: center;
  padding: var(--space-6);
}

.accept__panel {
  width: min(34rem, 100%);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  padding: var(--space-7);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
  box-shadow: var(--shadow);
}

.accept__brand {
  font-family: var(--mono);
  font-size: var(--step--1);
  letter-spacing: 0.16em;
  color: var(--ink);
}

.accept__title {
  font-size: var(--step-2);
}

.accept__lede {
  font-size: var(--step--1);
  color: var(--text-2);
  max-width: 46ch;
}

.accept__form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-top: var(--space-3);
}

.accept__error {
  font-size: var(--step--1);
  color: var(--rejeitado);
  background: var(--rejeitado-bg);
  border-radius: var(--radius-sm);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.accept__ref {
  font-size: 0.78rem;
  color: var(--text-3);
}

.accept__go {
  align-self: flex-start;
  margin-top: var(--space-2);
}
</style>
