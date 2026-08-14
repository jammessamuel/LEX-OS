import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CaseTasksView from '../views/CaseTasksView.vue';
import { useSessionStore } from '../stores/session.js';

const request = vi.hoisted(() => vi.fn());

vi.mock('../api/client.js', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return { ...actual, request };
});

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'caso-1' } }),
}));

const caso = { id: 'caso-1', internalCode: 'DEMO-0001', title: 'Caso fictício' };

function task(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tk-1',
    caseId: 'caso-1',
    title: 'Reunir carteira de trabalho',
    description: 'Exigência pendente do checklist.',
    taskType: 'DOCUMENT_COLLECTION',
    status: 'OPEN',
    priority: 'NORMAL',
    assignedToId: null,
    createdById: 'user-1',
    dueAt: null,
    completedAt: null,
    sourceType: 'AI_CHECKLIST',
    sourceId: 'it-1',
    createdAt: '2026-08-12T12:00:00.000Z',
    updatedAt: '2026-08-12T12:00:00.000Z',
    ...overrides,
  };
}

function mockLoad(tasks: unknown[]): void {
  request.mockImplementation(async (path: string) => {
    if (path === '/users/assignable') {
      return { data: [], pageInfo: { nextCursor: null, hasNextPage: false } };
    }
    return path.endsWith('/tasks')
      ? { data: tasks, pageInfo: { nextCursor: null, hasNextPage: false } }
      : caso;
  });
}

const stubs = { RouterLink: { template: '<a><slot /></a>' } };
const mountView = () => mount(CaseTasksView, { global: { stubs } });

describe('CaseTasksView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useSessionStore().$patch({
      permissions: new Set(['cases.read', 'tasks.manage', 'users.read']),
    });
    request.mockReset();
    // Data fixa: o atraso é relativo a "hoje" e o teste não pode depender do relógio.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-12T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('destaca o atraso antes de qualquer lista, contando só o que está em aberto', async () => {
    mockLoad([
      task({ id: 'tk-late', dueAt: '2026-08-09T23:59:59.000Z' }),
      task({ id: 'tk-ok', dueAt: '2026-08-20T23:59:59.000Z' }),
      // Concluída com prazo vencido não conta como atraso: já foi feita.
      task({ id: 'tk-done', status: 'COMPLETED', dueAt: '2026-08-01T23:59:59.000Z' }),
    ]);

    const wrapper = mountView();
    await flushPromises();

    const verdict = wrapper.get('[role="status"]');
    expect(verdict.text()).toContain('1 tarefa atrasada');
    expect(verdict.text()).toContain('2 em aberto');
    expect(verdict.classes()).toContain('verdict--late');
    expect(wrapper.findAll('.task--late')).toHaveLength(1);
  });

  it('diz o prazo em linguagem de quem tem prazo, não em data crua', async () => {
    mockLoad([
      task({ id: 'a', dueAt: '2026-08-12T23:59:59.000Z' }),
      task({ id: 'b', dueAt: '2026-08-13T23:59:59.000Z' }),
      task({ id: 'c', dueAt: '2026-08-09T23:59:59.000Z' }),
    ]);

    const wrapper = mountView();
    await flushPromises();
    const text = wrapper.text();

    expect(text).toContain('Vence hoje');
    expect(text).toContain('Vence amanhã');
    expect(text).toContain('Atrasada 3 dias');
  });

  it('mostra a origem da tarefa e não vaza rótulo técnico', async () => {
    mockLoad([task({ priority: 'URGENT' })]);

    const wrapper = mountView();
    await flushPromises();
    const text = wrapper.text();

    expect(text).toContain('Origem no checklist');
    expect(text).toContain('Aberta');
    expect(text).toContain('Urgente');
    expect(text).not.toContain('AI_CHECKLIST');
    expect(text).not.toContain('OPEN');
    expect(text).not.toContain('URGENT');
  });

  it('o vazio aponta para o checklist, que é de onde a tarefa nasce', async () => {
    mockLoad([]);

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Nenhuma tarefa neste caso');
    expect(wrapper.text()).toContain('checklist');
  });

  it('conclui a tarefa pela rota real e troca o estado pelo retorno do servidor', async () => {
    const openTask = task();
    request.mockImplementation(async (path: string, options?: { body?: { status?: string } }) => {
      if (path === '/users/assignable') {
        return { data: [], pageInfo: { nextCursor: null, hasNextPage: false } };
      }
      if (path.startsWith('/tasks/')) {
        return task({ status: options?.body?.status, completedAt: '2026-08-12T12:30:00.000Z' });
      }
      return path.endsWith('/tasks')
        ? { data: [openTask], pageInfo: { nextCursor: null, hasNextPage: false } }
        : caso;
    });

    const wrapper = mountView();
    await flushPromises();

    await wrapper.get('button.task__action').trigger('click');
    await flushPromises();

    expect(request).toHaveBeenCalledWith('/tasks/tk-1', {
      method: 'PATCH',
      body: { status: 'COMPLETED' },
    });
    expect(wrapper.text()).toContain('Concluída');
    expect(wrapper.get('button.task__action').text()).toBe('Reabrir');
  });

  it('não oferece alteração para quem tem somente leitura de tarefas', async () => {
    useSessionStore().clear();
    mockLoad([task()]);

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Reunir carteira de trabalho');
    expect(wrapper.find('button.task__action').exists()).toBe(false);
    expect(request).not.toHaveBeenCalledWith('/users/assignable', expect.anything());
  });
});
