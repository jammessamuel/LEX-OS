import { createRouter, createWebHistory } from 'vue-router';

import AppShell from '../components/AppShell.vue';
import { useSessionStore } from '../stores/session.js';
import CaseDetailView from '../views/CaseDetailView.vue';
import CasesView from '../views/CasesView.vue';
import CaseTimelineView from '../views/CaseTimelineView.vue';
import DocumentDetailView from '../views/DocumentDetailView.vue';
import LoginView from '../views/LoginView.vue';

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      component: LoginView,
      name: 'login',
      path: '/entrar',
      meta: { public: true },
    },
    {
      component: AppShell,
      path: '/',
      children: [
        {
          component: CasesView,
          name: 'cases',
          path: '',
        },
        {
          component: CaseDetailView,
          name: 'case-detail',
          path: 'casos/:id',
        },
        {
          component: CaseTimelineView,
          name: 'case-timeline',
          path: 'casos/:id/cronologia',
        },
        {
          component: DocumentDetailView,
          name: 'document-detail',
          path: 'documentos/:id',
        },
      ],
    },
  ],
});

/**
 * A visibilidade das rotas acompanha a sessão, mas quem decide é o servidor: cada resposta
 * ainda é autorizada por permissão e por organização. Este guarda evita telas vazias, não
 * substitui autorização.
 */
router.beforeEach(async (to) => {
  const session = useSessionStore();

  if (session.restoring) {
    await session.restore();
  }

  if (to.meta.public === true) {
    return session.isAuthenticated ? { name: 'cases' } : true;
  }

  return session.isAuthenticated ? true : { name: 'login', query: { destino: to.fullPath } };
});
