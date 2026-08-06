<script setup lang="ts">
import { useRouter } from 'vue-router';

import { useSessionStore } from '../stores/session.js';

const session = useSessionStore();
const router = useRouter();

async function signOut(): Promise<void> {
  await session.logout();
  await router.replace({ name: 'login' });
}
</script>

<template>
  <div class="shell">
    <header class="shell__bar">
      <div class="shell__identity">
        <span class="shell__brand">LEX OS</span>
        <span v-if="session.organization" class="shell__org">
          {{ session.organization.tradeName }}
        </span>
      </div>

      <nav class="shell__nav" aria-label="Seções">
        <RouterLink class="shell__link" :to="{ name: 'cases' }">Casos</RouterLink>
      </nav>

      <div class="shell__account">
        <span v-if="session.user" class="shell__user">{{ session.user.name }}</span>
        <button class="btn btn--ghost" type="button" @click="signOut">Sair</button>
      </div>
    </header>

    <main class="shell__content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100%;
  display: grid;
  grid-template-rows: auto 1fr;
}

.shell__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-6);
  background: var(--surface);
  border-bottom: 1px solid var(--line);
}

.shell__identity {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  min-width: 0;
}

.shell__brand {
  font-family: var(--mono);
  font-size: var(--step--1);
  letter-spacing: 0.16em;
  color: var(--ink);
}

.shell__org {
  font-family: var(--serif);
  font-size: var(--step-0);
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shell__nav {
  display: flex;
  gap: var(--space-2);
  margin-inline-start: var(--space-4);
}

.shell__link {
  font-size: var(--step--1);
  font-weight: 600;
  color: var(--text-2);
  text-decoration: none;
  padding: 0.3rem 0.6rem;
  border-radius: var(--radius);
}

.shell__link:hover {
  color: var(--text);
  background: var(--surface-sunk);
}

.shell__link.router-link-active {
  color: var(--ink);
  background: color-mix(in oklab, var(--ink) 12%, transparent);
}

.shell__account {
  margin-inline-start: auto;
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.shell__user {
  font-size: var(--step--1);
  color: var(--text-2);
}

.shell__content {
  padding: var(--space-6) var(--space-6);
  width: min(var(--content-max), 100%);
  margin-inline: auto;
}
</style>
