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
const savePassword = ref(saved.savePassword);

/**
 * Segundo passo. A senha correta de quem tem o fator ativo devolve 401 com um código
 * próprio; a tela então pede o código em vez de tratar aquilo como credencial errada.
 */
const needsSecondFactor = ref(false);
const secondFactorCode = ref('');
const email = ref(saved.email);
const password = ref(saved.password);
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
      ...(secondFactorCode.value === '' ? {} : { secondFactorCode: secondFactorCode.value }),
    });
    // Guardado só depois de entrar: lembrar um e-mail que nem existe não ajuda ninguém.
    // A senha nunca entra aqui — quem a guarda é o gerenciador do navegador.
    rememberSignIn({
      ...credentials,
      keepSignedIn: keepSignedIn.value,
      savePassword: savePassword.value,
      password: password.value,
    });
    await router.replace(destinationAfterLogin());
  } catch (error) {
    const apiError =
      error instanceof ApiError
        ? error
        : new ApiError({
            statusCode: 0,
            code: 'UNEXPECTED',
            message: 'Não foi possível entrar. Tente novamente.',
          });

    if (apiError.code === 'SECOND_FACTOR_REQUIRED') {
      // A senha estava certa: guardar o passo evita pedi-la de novo, e o erro some porque
      // não houve erro nenhum.
      needsSecondFactor.value = true;
      failure.value = null;
      return;
    }

    failure.value = apiError;
    secondFactorCode.value = '';
    // A senha só é apagada quando ela própria pode estar errada. No segundo passo o que
    // falhou foi o código, e refazer a senha inteira seria castigo por erro de digitação.
    if (!needsSecondFactor.value) {
      password.value = '';
    }
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
        <template v-if="!needsSecondFactor">
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

          <label class="keep">
            <input v-model="keepSignedIn" type="checkbox" name="keep-signed-in" />
            <span class="keep__text">
              Manter conectado neste dispositivo
              <span class="keep__hint">
                Deixe desmarcado em computador compartilhado: a sessão termina ao fechar o
                navegador.
              </span>
            </span>
          </label>

          <label class="keep">
            <input v-model="savePassword" type="checkbox" name="save-password" />
            <span class="keep__text">
              Guardar também a senha neste dispositivo
              <span class="keep__hint">
                Ela fica legível para quem tiver acesso a este computador ou ao navegador. Em
                máquina compartilhada, prefira deixar o navegador guardar por você.
              </span>
            </span>
          </label>
        </template>

        <template v-else>
          <p class="login__step">Senha conferida. Agora o código do seu aplicativo autenticador.</p>
          <div class="field">
            <label class="label" for="secondFactorCode">Código</label>
            <input
              id="secondFactorCode"
              v-model="secondFactorCode"
              name="one-time-code"
              class="data login__code"
              inputmode="numeric"
              autocomplete="one-time-code"
              autofocus
              maxlength="32"
              placeholder="123456"
            />
            <p class="field__hint">
              Perdeu o telefone? Use um dos códigos de recuperação que você guardou ao ativar.
            </p>
          </div>
        </template>

        <!-- Fora dos dois passos, de propósito: a recusa do código também precisa aparecer,
             e antes ela ficava escondida no primeiro passo. A API não distingue usuário
             inexistente de senha errada, e a mensagem que ela devolve já é a versão segura. -->
        <p v-if="failure && failure.details.length === 0" class="login__failure" role="alert">
          {{ failure.message }}
        </p>

        <button class="btn login__submit" type="submit" :disabled="submitting">
          {{ submitting ? 'Entrando…' : needsSecondFactor ? 'Confirmar código' : 'Entrar' }}
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
.login__step {
  font-size: var(--step--1);
  color: var(--text-2);
  max-width: 44ch;
}

/* Código em mono e espaçado: seis dígitos lidos de um telefone e digitados aqui. */
.login__code {
  font-size: var(--step-1);
  letter-spacing: 0.18em;
}

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
