<script setup lang="ts">
import { useSessionStore } from '../stores/session.js';

const session = useSessionStore();
</script>

<template>
  <section class="state" role="alert" aria-labelledby="access-title">
    <p class="label">Acesso</p>
    <h1 id="access-title">Esta área não está disponível para o seu perfil</h1>
    <p class="state__body">
      As permissões são definidas pelo escritório. Se você precisa trabalhar nesta área, solicite o
      acesso a uma pessoa administradora.
    </p>
    <RouterLink v-if="session.can('cases.read')" class="btn" :to="{ name: 'cases' }">
      Voltar aos casos
    </RouterLink>
  </section>
</template>

<style scoped>
.state {
  max-width: 44rem;
}
</style>
