import { createRouter, createWebHistory } from 'vue-router';

import AppShell from '../components/AppShell.vue';
import { readPreferences, rememberRoute } from '../stores/preferences.js';
import { useSessionStore } from '../stores/session.js';
import AccessDeniedView from '../views/AccessDeniedView.vue';
import AuditView from '../views/AuditView.vue';
import CaseChecklistView from '../views/CaseChecklistView.vue';
import CaseDetailView from '../views/CaseDetailView.vue';
import CaseFormView from '../views/CaseFormView.vue';
import AgendaView from '../views/AgendaView.vue';
import CasesView from '../views/CasesView.vue';
import DashboardView from '../views/DashboardView.vue';
import CaseTasksView from '../views/CaseTasksView.vue';
import CaseTimelineView from '../views/CaseTimelineView.vue';
import DocumentDetailView from '../views/DocumentDetailView.vue';
import AcceptInvitationView from '../views/AcceptInvitationView.vue';
import ForgotPasswordView from '../views/ForgotPasswordView.vue';
import NewPasswordView from '../views/NewPasswordView.vue';
import LoginView from '../views/LoginView.vue';
import PersonDetailView from '../views/PersonDetailView.vue';
import PersonFormView from '../views/PersonFormView.vue';
import PersonsView from '../views/PersonsView.vue';
import SearchView from '../views/SearchView.vue';
import SecurityView from '../views/SecurityView.vue';
import UsersView from '../views/UsersView.vue';

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
      // Publica por necessidade: quem aceita ainda nao tem sessao, e o token no link e a
      // unica prova que ela apresenta.
      component: AcceptInvitationView,
      name: 'accept-invitation',
      path: '/convite',
      meta: { public: true },
    },
    {
      // Publicas: quem esqueceu a senha nao tem sessao, e o token do link e a unica prova.
      component: ForgotPasswordView,
      name: 'forgot-password',
      path: '/esqueci-a-senha',
      meta: { public: true },
    },
    {
      component: NewPasswordView,
      name: 'new-password',
      path: '/nova-senha',
      meta: { public: true },
    },
    {
      component: AppShell,
      path: '/',
      children: [
        {
          component: DashboardView,
          name: 'dashboard',
          path: 'painel',
          meta: { permissions: ['cases.read', 'documents.read', 'tasks.read'] },
        },
        {
          component: AgendaView,
          name: 'agenda',
          path: 'agenda',
          meta: { permissions: ['tasks.read'] },
        },
        {
          component: CasesView,
          name: 'cases',
          path: '',
          meta: { permissions: ['cases.read'] },
        },
        {
          component: CaseDetailView,
          name: 'case-detail',
          path: 'casos/:id',
          meta: { permissions: ['cases.read'] },
        },
        {
          component: CaseFormView,
          name: 'case-create',
          path: 'casos/novo',
          meta: { permissions: ['cases.create'] },
        },
        {
          component: CaseFormView,
          name: 'case-edit',
          path: 'casos/:id/editar',
          meta: { permissions: ['cases.read', 'cases.update'] },
        },
        {
          component: CaseTimelineView,
          name: 'case-timeline',
          path: 'casos/:id/cronologia',
          meta: { permissions: ['cases.read'] },
        },
        {
          component: CaseChecklistView,
          name: 'case-checklist',
          path: 'casos/:id/checklist',
          meta: { permissions: ['cases.read'] },
        },
        {
          component: CaseTasksView,
          name: 'case-tasks',
          path: 'casos/:id/tarefas',
          meta: { permissions: ['tasks.read'] },
        },
        {
          component: DocumentDetailView,
          name: 'document-detail',
          path: 'documentos/:id',
          meta: { permissions: ['documents.read'] },
        },
        {
          component: UsersView,
          name: 'users',
          path: 'equipe',
          meta: { permissions: ['users.read'] },
        },
        {
          component: PersonsView,
          name: 'persons',
          path: 'pessoas',
          meta: { permissions: ['persons.read'] },
        },
        {
          component: PersonFormView,
          name: 'person-create',
          path: 'pessoas/nova',
          meta: { permissions: ['persons.manage'] },
        },
        {
          component: PersonDetailView,
          name: 'person-detail',
          path: 'pessoas/:id',
          meta: { permissions: ['persons.read'] },
        },
        {
          component: PersonFormView,
          name: 'person-edit',
          path: 'pessoas/:id/editar',
          meta: { permissions: ['persons.read', 'persons.manage'] },
        },
        {
          component: SearchView,
          name: 'search',
          path: 'busca',
          meta: { permissions: ['cases.read', 'knowledge.search'] },
        },
        {
          component: AuditView,
          name: 'audit',
          path: 'auditoria',
          meta: { permissions: ['audit.read', 'confidential_cases.read'] },
        },
        {
          // Sem permissao: qualquer pessoa autenticada cuida da propria seguranca.
          component: SecurityView,
          name: 'security',
          path: 'conta/seguranca',
        },
        {
          component: AccessDeniedView,
          name: 'access-denied',
          path: 'sem-acesso',
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
    if (!session.isAuthenticated) {
      return true;
    }
    // Já autenticado abrindo a entrada: volta para onde parou, se houver.
    const resumed = readPreferences().lastRoute;
    return resumed === null ? { name: 'cases' } : resumed;
  }

  if (!session.isAuthenticated) {
    return { name: 'login', query: { destino: to.fullPath } };
  }

  const required = Array.isArray(to.meta.permissions) ? to.meta.permissions : [];
  return required.every((permission) => typeof permission === 'string' && session.can(permission))
    ? true
    : { name: 'access-denied' };
});

/**
 * Guarda a última tela para retomar na próxima abertura.
 *
 * Depois da navegação, e só o caminho — nada de conteúdo. Telas de erro e de entrada ficam
 * de fora: retomar em "sem acesso" seria um beco, e retomar na entrada não retoma nada.
 */
const notWorthResuming = new Set([
  'login',
  'accept-invitation',
  'forgot-password',
  'new-password',
  'access-denied',
]);

router.afterEach((to) => {
  if (typeof to.name === 'string' && !notWorthResuming.has(to.name)) {
    rememberRoute(to.fullPath);
  }
});
