<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ApiError } from '../api/client.js';
import { readPreferences, rememberSignIn } from '../stores/preferences.js';
import { useSessionStore } from '../stores/session.js';

const router = useRouter();
const route = useRoute();
const session = useSessionStore();

const saved = readPreferences();

// O escritório pode chegar pelo link de convite, que tem prioridade sobre o lembrado: quem
// abre um convite está entrando em um escritório específico, talvez outro.
const organizationSlug = ref(
  typeof route.query.escritorio === 'string' ? route.query.escritorio : saved.organizationSlug,
);
const keepSignedIn = ref(saved.keepSignedIn);
const email = ref(saved.email);
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
    const credentials = {
      organizationSlug: organizationSlug.value.trim().toLowerCase(),
      email: email.value.trim(),
    };
    await session.login({
      ...credentials,
      password: password.value,
      keepSignedIn: keepSignedIn.value,
    });
    // Guardado só depois de entrar: lembrar um e-mail que nem existe não ajuda ninguém.
    // A senha nunca entra aqui — quem a guarda é o gerenciador do navegador.
    rememberSignIn({ ...credentials, keepSignedIn: keepSignedIn.value });
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
            name="organization"
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
            name="username"
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
            name="current-password"
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

        <label class="keep">
          <input v-model="keepSignedIn" type="checkbox" name="keep-signed-in" />
          <span class="keep__text">
            Manter conectado neste dispositivo
            <span class="keep__hint">
              Deixe desmarcado em computador compartilhado: a sessão termina ao fechar o navegador.
            </span>
          </span>
        </label>

        <button class="btn login__submit" type="submit" :disabled="submitting">
          {{ submitting ? 'Entrando…' : 'Entrar' }}
        </button>
      </form>

      <RouterLink class="login__forgot" :to="{ name: 'forgot-password' }">
        Esqueci minha senha
      </RouterLink>
    </section>

    <p class="login__note">
      A identificação da organização será substituída por um endereço próprio de cada escritório
      quando o cadastro público for liberado.
    </p>
  </main>
</template>

<style scoped>
.login__forgot {
  font-size: var(--step--1);
  color: var(--ink);
  text-decoration: none;
  margin-top: var(--space-4);
  align-self: flex-start;
}

.login__forgot:hover {
  text-decoration: underline;
  text-underline-offset: 0.2em;
}

.keep {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  cursor: pointer;
}

.keep input {
  width: 1.05rem;
  height: 1.05rem;
  margin-top: 0.15rem;
  accent-color: var(--ink);
  flex: none;
}

.keep__text {
  font-size: var(--step--1);
  color: var(--text);
}

.keep__hint {
  display: block;
  font-size: 0.82rem;
  color: var(--text-3);
  margin-top: var(--space-1);
  max-width: 44ch;
}

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
