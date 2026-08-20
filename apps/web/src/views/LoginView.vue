<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ApiError } from '../api/client.js';
import { useSessionStore } from '../stores/session.js';

const router = useRouter();
const route = useRoute();
const session = useSessionStore();

// O escritorio pode chegar pelo link de convite: e identificador, nao conteudo, entao
// pode viver na URL. Digitado a mao tambem vale, que e o caso de quem ja trabalha aqui.
const organizationSlug = ref(
  typeof route.query.escritorio === 'string' ? route.query.escritorio : '',
);
const email = ref('');
const password = ref('');
const submitting = ref(false);
const failure = ref<ApiError | null>(null);

function destinationAfterLogin(): string | { name: 'cases' } {
  const destination = route.query.destino;
  return typeof destination === 'string' &&
    destination.startsWith('/') &&
    !destination.startsWith('//')
    ? destination
    : { name: 'cases' };
}

async function submit(): Promise<void> {
  submitting.value = true;
  failure.value = null;
  try {
    await session.login({
      organizationSlug: organizationSlug.value.trim().toLowerCase(),
      email: email.value.trim(),
      password: password.value,
    });
    await router.replace(destinationAfterLogin());
  } catch (error) {
    failure.value =
      error instanceof ApiError
        ? error
        : new ApiError({
            statusCode: 0,
            code: 'UNEXPECTED',
            message: 'Não foi possível entrar. Tente novamente.',
          });
    password.value = '';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main class="login">
    <section class="login__panel" aria-labelledby="login-title">
      <p class="login__brand">LEX OS</p>
      <h1 id="login-title" class="login__title">Entrar</h1>
      <p class="login__lede">Acesse a plataforma operacional do escritório.</p>

      <form class="login__form" novalidate @submit.prevent="submit">
        <div class="field">
          <label class="label" for="organizationSlug">Escritório</label>
          <input
            id="organizationSlug"
            v-model="organizationSlug"
            class="data"
            autocomplete="organization"
            spellcheck="false"
            placeholder="souza-cabral"
            :aria-invalid="failure?.detailFor('organizationSlug') !== undefined"
            :aria-describedby="
              failure?.detailFor('organizationSlug') === undefined
                ? 'organizationSlug-hint'
                : 'organizationSlug-error'
            "
          />
          <p
            v-if="failure?.detailFor('organizationSlug')"
            id="organizationSlug-error"
            class="field__error"
          >
            {{ failure.detailFor('organizationSlug') }}
          </p>
          <p v-else id="organizationSlug-hint" class="field__hint">
            O nome curto do escritório, o mesmo que aparece no link do convite.
          </p>
        </div>

        <div class="field">
          <label class="label" for="email">E-mail</label>
          <input
            id="email"
            v-model="email"
            type="email"
            autocomplete="username"
            :aria-invalid="failure?.detailFor('email') !== undefined"
            :aria-describedby="failure?.detailFor('email') ? 'email-error' : undefined"
          />
          <p v-if="failure?.detailFor('email')" id="email-error" class="field__error">
            {{ failure.detailFor('email') }}
          </p>
        </div>

        <div class="field">
          <label class="label" for="password">Senha</label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            :aria-invalid="failure?.detailFor('password') !== undefined"
            :aria-describedby="failure?.detailFor('password') ? 'password-error' : undefined"
          />
          <p v-if="failure?.detailFor('password')" id="password-error" class="field__error">
            {{ failure.detailFor('password') }}
          </p>
        </div>

        <!-- A API não distingue usuário inexistente de senha errada, e a interface preserva
             isso: a mensagem que ela devolve já é a versão segura. -->
        <p v-if="failure && failure.details.length === 0" class="login__failure" role="alert">
          {{ failure.message }}
        </p>

        <button class="btn login__submit" type="submit" :disabled="submitting">
          {{ submitting ? 'Entrando…' : 'Entrar' }}
        </button>
      </form>
    </section>

    <p class="login__note">
      A identificação da organização será substituída por um endereço próprio de cada escritório
      quando o cadastro público for liberado.
    </p>
  </main>
</template>

<style scoped>
.login {
  min-height: 100%;
  display: grid;
  grid-template-rows: 1fr auto;
  justify-items: center;
  align-items: center;
  padding: var(--space-6) var(--space-4);
  gap: var(--space-5);
}

.login__panel {
  width: min(24rem, 100%);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow);
  align-self: end;
}

.login__brand {
  font-family: var(--mono);
  font-size: var(--step--1);
  letter-spacing: 0.18em;
  color: var(--ink);
  margin-bottom: var(--space-5);
}

.login__title {
  font-size: var(--step-2);
  margin-bottom: var(--space-2);
}

.login__lede {
  color: var(--text-2);
  font-size: var(--step--1);
  margin-bottom: var(--space-6);
}

.login__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.login__failure {
  font-size: var(--step--1);
  color: var(--rejeitado);
  background: var(--rejeitado-bg);
  border: 1px solid color-mix(in oklab, var(--rejeitado) 26%, transparent);
  border-radius: var(--radius);
  padding: var(--space-3);
}

.login__submit {
  margin-top: var(--space-2);
  width: 100%;
}

.login__note {
  align-self: start;
  max-width: 24rem;
  text-align: center;
  font-size: var(--step--1);
  color: var(--text-3);
}
</style>
