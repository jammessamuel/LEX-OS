<script setup lang="ts">
import { computed, ref } from 'vue';

import { ApiError, request } from '../api/client.js';
import { organizationSlugPattern } from '../domain/identity.js';
import { readPreferences } from '../stores/preferences.js';

/**
 * Pedido de redefinição de senha.
 *
 * A tela nunca diz se a conta existe, porque a API também não diz. Depois de enviar, a
 * confirmação é a mesma para endereço cadastrado, desconhecido ou bloqueado — se ela variasse,
 * a tela viraria o oráculo que a rota inteira existe para não ser.
 *
 * A única resposta que se distingue é o limite de tentativas, e essa é para o próprio usuário:
 * quem já pediu três vezes na última hora precisa saber que o problema é esse, não o e-mail.
 */

const saved = readPreferences();

const organizationSlug = ref(saved.organizationSlug);
const email = ref(saved.email);
const submitting = ref(false);
const sent = ref(false);
const rateLimited = ref(false);
const failure = ref<ApiError | null>(null);

const ready = computed(
  () =>
    organizationSlugPattern.test(organizationSlug.value.trim().toLowerCase()) &&
    email.value.includes('@'),
);

async function submit(): Promise<void> {
  submitting.value = true;
  failure.value = null;
  rateLimited.value = false;
  try {
    await request('/auth/password-reset', {
      method: 'POST',
      body: {
        organizationSlug: organizationSlug.value.trim().toLowerCase(),
        email: email.value.trim().toLowerCase(),
      },
      skipRefresh: true,
    });
    sent.value = true;
  } catch (error) {
    if (error instanceof ApiError && error.code === 'AUTH_RATE_LIMITED') {
      rateLimited.value = true;
    } else {
      failure.value =
        error instanceof ApiError
          ? error
          : new ApiError({
              statusCode: 0,
              code: 'UNEXPECTED',
              message: 'Não foi possível concluir. Tente novamente.',
            });
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main class="gate">
    <section class="gate__panel" aria-labelledby="forgot-title">
      <p class="gate__brand">LEX OS</p>

      <template v-if="sent">
        <h1 id="forgot-title" class="gate__title">Pedido registrado</h1>
        <!-- Deliberadamente condicional: a tela não sabe, e não pode fingir que sabe. -->
        <p class="gate__lede">
          Se houver uma conta ativa com esse e-mail no escritório informado, o endereço para criar a
          nova senha chegou por e-mail. Ele vale por uma hora e serve uma vez só.
        </p>
        <p class="gate__lede">
          Não chegou? Confira a caixa de spam e o escritório digitado. Se ainda assim nada vier,
          fale com quem administra o LEX OS no seu escritório.
        </p>
        <RouterLink class="btn gate__go" :to="{ name: 'login' }">Voltar para a entrada</RouterLink>
      </template>

      <template v-else>
        <h1 id="forgot-title" class="gate__title">Esqueci minha senha</h1>
        <p class="gate__lede">
          Informe o escritório e o e-mail com que você entra. Enviaremos um endereço para criar uma
          senha nova.
        </p>

        <form class="gate__form" novalidate @submit.prevent="submit">
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
            />
          </div>

          <div class="field">
            <label class="label" for="email">E-mail</label>
            <input
              id="email"
              v-model="email"
              name="username"
              type="email"
              autocomplete="username"
            />
          </div>

          <p v-if="rateLimited" class="gate__notice" role="alert">
            Já houve pedidos demais para este e-mail na última hora. Aguarde antes de tentar de novo
            — o link do pedido anterior pode ainda estar valendo.
          </p>

          <p v-else-if="failure" class="gate__error" role="alert">
            {{ failure.message }}
            <span v-if="failure.requestId" class="gate__ref data">
              Referência para o suporte: {{ failure.requestId }}
            </span>
          </p>

          <button class="btn gate__go" type="submit" :disabled="!ready || submitting">
            {{ submitting ? 'Enviando…' : 'Enviar endereço de redefinição' }}
          </button>
        </form>

        <RouterLink class="gate__back" :to="{ name: 'login' }">Voltar para a entrada</RouterLink>
      </template>
    </section>
  </main>
</template>

<style scoped>
@import '../styles/gate.css';
</style>
