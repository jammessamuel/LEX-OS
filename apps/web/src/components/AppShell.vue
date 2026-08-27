<script setup lang="ts">
import { useRouter } from 'vue-router';

import { forgetIdentity } from '../stores/preferences.js';
import { useSessionStore } from '../stores/session.js';
import { useTheme } from '../stores/theme.js';

const session = useSessionStore();
const router = useRouter();
const theme = useTheme();

async function signOut(): Promise<void> {
  await session.logout();
  // Sair é um gesto deliberado: o e-mail e a última tela vão junto. O escritório fica, que
  // é do dispositivo e não da pessoa.
  forgetIdentity();
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
        <RouterLink
          v-if="
            session.can('cases.read') && session.can('documents.read') && session.can('tasks.read')
          "
          class="shell__link"
          :to="{ name: 'dashboard' }"
        >
          Painel
        </RouterLink>
        <RouterLink v-if="session.can('cases.read')" class="shell__link" :to="{ name: 'cases' }">
          Casos
        </RouterLink>
        <RouterLink v-if="session.can('tasks.read')" class="shell__link" :to="{ name: 'agenda' }">
          Agenda
        </RouterLink>
        <RouterLink
          v-if="session.can('persons.read')"
          class="shell__link"
          :to="{ name: 'persons' }"
        >
          Pessoas
        </RouterLink>
        <RouterLink
          v-if="session.can('cases.read') && session.can('knowledge.search')"
          class="shell__link"
          :to="{ name: 'search' }"
        >
          Busca
        </RouterLink>
        <RouterLink
          v-if="session.can('audit.read') && session.can('confidential_cases.read')"
          class="shell__link"
          :to="{ name: 'audit' }"
        >
          Auditoria
        </RouterLink>
        <RouterLink
          v-if="session.can('processing_costs.read')"
          class="shell__link"
          :to="{ name: 'processing-costs' }"
        >
          Custos
        </RouterLink>
        <RouterLink v-if="session.can('users.read')" class="shell__link" :to="{ name: 'users' }">
          Equipe
        </RouterLink>
      </nav>

      <div class="shell__account">
        <RouterLink v-if="session.user" class="shell__user" :to="{ name: 'security' }">
          {{ session.user.name }}
        </RouterLink>
        <button
          class="shell__theme"
          type="button"
          :aria-label="theme.nextLabel.value"
          :title="theme.nextLabel.value"
          @click="theme.toggle"
        >
          <span aria-hidden="true">{{ theme.preference.value === 'dark' ? '☀' : '☾' }}</span>
        </button>
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
  min-width: 0;
  width: 100%;
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
  min-width: 0;
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
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-inline-start: var(--space-4);
  min-width: 0;
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
  text-decoration: none;
  padding: 0.3rem 0.5rem;
  border-radius: var(--radius);
}

.shell__user:hover,
.shell__user.router-link-active {
  color: var(--ink);
  background: var(--surface-sunk);
}

.shell__theme {
  display: inline-grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius);
  background: transparent;
  color: var(--text);
  font-size: 1.1rem;
  cursor: pointer;
}

.shell__content {
  padding: var(--space-6) var(--space-6);
  width: min(var(--content-max), 100%);
  margin-inline: auto;
  min-width: 0;
}

@media (max-width: 48rem) {
  .shell__bar {
    padding: var(--space-3);
  }

  .shell__nav {
    order: 3;
    width: 100%;
    margin-inline-start: 0;
  }

  .shell__content {
    padding: var(--space-4) var(--space-3);
  }
}
</style>
