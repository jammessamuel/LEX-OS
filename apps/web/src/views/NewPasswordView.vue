<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ApiError, request } from '../api/client.js';
import { forgetIdentity } from '../stores/preferences.js';

/**
 * Criação da nova senha.
 *
 * Mesma forma do aceite de convite, e a semelhança é proposital: são o mesmo mecanismo —
 * token de uso único, com validade, guardado só em hash. A recusa também é a mesma para os
 * quatro casos, porque a API não os distingue e a tela não pode inventar a diferença.
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
    await request('/auth/password-reset/complete', {
      method: 'POST',
      body: { token: token.value, password: password.value },
      skipRefresh: true,
    });
    done.value = true;
    // As sessões dessa pessoa caíram no servidor. Esquecer a identidade guardada aqui evita
    // que o dispositivo continue oferecendo um e-mail cuja sessão não existe mais.
    forgetIdentity();
  } catch (error) {
    failure.value =
      error instanceof ApiError
        ? error
        : new ApiError({
            statusCode: 0,
            code: 'UNEXPECTED',
            message: 'Não foi possível concluir. Tente novamente.',
          });
  } finally {
    password.value = '';
    confirmation.value = '';
    submitting.value = false;
  }
}

function goToSignIn(): void {
  void router.replace({ name: 'login' });
}
</script>

<template>
  <main class="gate">
    <section class="gate__panel" aria-labelledby="new-password-title">
      <p class="gate__brand">LEX OS</p>

      <template v-if="done">
        <h1 id="new-password-title" class="gate__title">Senha alterada</h1>
        <p class="gate__lede">
          Sua nova senha já vale. Por segurança, as sessões que estavam abertas em outros
          dispositivos foram encerradas — se alguém tinha acesso indevido, perdeu agora.
        </p>
        <button class="btn gate__go" type="button" @click="goToSignIn">Entrar</button>
      </template>

      <!-- Link sem token: quase sempre é cópia parcial, e dizer isso poupa uma tentativa. -->
      <template v-else-if="token === ''">
        <h1 id="new-password-title" class="gate__title">Falta o código no link</h1>
        <p class="gate__lede">
          O endereço aberto não traz o código do pedido. Isso costuma acontecer quando o link é
          copiado pela metade. Abra o link direto do e-mail, ou peça um novo.
        </p>
        <RouterLink class="btn gate__go" :to="{ name: 'forgot-password' }">
          Pedir um novo link
        </RouterLink>
      </template>

      <template v-else>
        <h1 id="new-password-title" class="gate__title">Criar nova senha</h1>
        <p class="gate__lede">
          Defina a senha que você vai usar daqui em diante. Este link vale uma vez só.
        </p>

        <form class="gate__form" novalidate @submit.prevent="submit">
          <div class="field">
            <label class="label" for="password">Nova senha</label>
            <input
              id="password"
              v-model="password"
              name="new-password"
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
              name="new-password-confirmation"
              type="password"
              autocomplete="new-password"
              :aria-invalid="mismatch"
              :aria-describedby="mismatch ? 'confirmation-error' : undefined"
            />
            <p v-if="mismatch" id="confirmation-error" class="field__error">
              As duas senhas estão diferentes.
            </p>
          </div>

          <p v-if="failure" class="gate__error" role="alert">
            {{ failure.message }}
            <span v-if="failure.requestId" class="gate__ref data">
              Referência para o suporte: {{ failure.requestId }}
            </span>
          </p>

          <button class="btn gate__go" type="submit" :disabled="!ready || submitting">
            {{ submitting ? 'Salvando…' : 'Salvar nova senha' }}
          </button>
        </form>

        <RouterLink class="gate__back" :to="{ name: 'forgot-password' }">
          Pedir um novo link
        </RouterLink>
      </template>
    </section>
  </main>
</template>

<style scoped>
@import '../styles/gate.css';
</style>
