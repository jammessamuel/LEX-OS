import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AgendaView from '../views/AgendaView.vue';

const request = vi.hoisted(() => vi.fn());

vi.mock('../api/client.js', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return { ...actual, request };
});

const { ApiError } = await import('../api/client');

function mountView() {
  return mount(AgendaView, {
    global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
  });
}

/** Prazo ancorado no dia de hoje do fuso local: a tela agrupa pelo calendário de quem lê. */
function atLocalHour(dayOffset: number, hour: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour);
  return date.toISOString();
}

function task(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    caseId: 'case-1',
    title: 'Protocolar contestação',
    description: null,
    taskType: 'DOCUMENT_COLLECTION',
    status: 'OPEN' as const,
    priority: 'HIGH' as const,
    assignedToId: null,
    createdById: null,
    dueAt: atLocalHour(0, 14),
    completedAt: null,
    sourceType: 'USER' as const,
    sourceId: null,
    createdAt: '2026-08-20T12:00:00.000Z',
    updatedAt: '2026-08-20T12:00:00.000Z',
    case: {
      id: 'case-1',
      internalCode: 'DEMO-0001',
      cnjNumber: '0001234-27.2026.5.02.0001',
      title: 'Caso fictício de demonstração',
    },
    assignedTo: { id: 'user-1', name: 'Advogada Fictícia' },
    ...overrides,
  };
}

function agenda(overrides: Record<string, unknown> = {}) {
  return {
    range: {
      from: atLocalHour(0, 0),
      to: atLocalHour(7, 0),
      generatedAt: atLocalHour(0, 9),
    },
    overdue: { tasks: [], total: 0, truncated: false },
    upcoming: { tasks: [task()], total: 1, truncated: false },
    ...overrides,
  };
}

describe('AgendaView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    request.mockReset();
  });

  it('agrupa por dia e nomeia hoje e amanhã por extenso', async () => {
    request.mockResolvedValue(
      agenda({
        upcoming: {
          tasks: [task(), task({ id: 'task-2', dueAt: atLocalHour(1, 9) })],
          total: 2,
          truncated: false,
        },
      }),
    );

    const wrapper = mountView();
    await flushPromises();
    const text = wrapper.text();

    expect(text).toContain('Hoje');
    expect(text).toContain('Amanhã');
    expect(wrapper.findAll('.agenda-day')).toHaveLength(2);
  });

  it('põe o vencido na frente e diz há quantos dias', async () => {
    request.mockResolvedValue(
      agenda({
        overdue: {
          tasks: [task({ id: 'task-late', dueAt: atLocalHour(-3, 14) })],
          total: 1,
          truncated: false,
        },
      }),
    );

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('1 prazo vencido');
    expect(wrapper.get('.panel--late').text()).toContain('3 dias');
  });

  it('usa o plural certo quando há mais de um vencido', async () => {
    request.mockResolvedValue(
      agenda({
        overdue: {
          tasks: [
            task({ id: 'a', dueAt: atLocalHour(-1, 10) }),
            task({ id: 'b', dueAt: atLocalHour(-2, 10) }),
          ],
          total: 2,
          truncated: false,
        },
      }),
    );

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('2 prazos vencidos');
  });

  it('mostra o número do processo ao lado do prazo, sem exigir abrir o caso', async () => {
    request.mockResolvedValue(agenda());

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('0001234-27.2026.5.02.0001');
    expect(wrapper.text()).toContain('Caso fictício de demonstração');
  });

  it('pede a janela em instantes ISO e começa à meia-noite local', async () => {
    request.mockResolvedValue(agenda());

    mountView();
    await flushPromises();

    const call = request.mock.calls[0] as [string, { query: { from: string; to: string } }];
    expect(call[0]).toBe('/agenda');
    const from = new Date(call[1].query.from);
    expect(from.getHours()).toBe(0);
    expect(from.getMinutes()).toBe(0);
    const to = new Date(call[1].query.to);
    expect(Math.round((to.getTime() - from.getTime()) / 86_400_000)).toBe(7);
  });

  it('troca a janela sem recarregar a tela inteira', async () => {
    request.mockResolvedValue(agenda());

    const wrapper = mountView();
    await flushPromises();
    request.mockClear();

    await wrapper.get('button[aria-pressed="false"]').trigger('click');
    await flushPromises();

    expect(request).toHaveBeenCalledTimes(1);
  });

  it('restringe ao usuário quando ele pede só os seus', async () => {
    request.mockResolvedValue(agenda());

    const wrapper = mountView();
    await flushPromises();
    request.mockClear();

    const buttons = wrapper.findAll('button');
    const mine = buttons.find((button) => button.text().includes('Ver só os meus'));
    await mine?.trigger('click');
    await flushPromises();

    const call = request.mock.calls[0] as [string, { query: Record<string, string> }];
    expect(call[1].query.scope).toBe('mine');
    expect(wrapper.text()).toContain('Vendo só os meus');
  });

  it('diz quando a lista foi cortada, em vez de deixar parecer que é tudo', async () => {
    request.mockResolvedValue(
      agenda({ upcoming: { tasks: [task()], total: 240, truncated: true } }),
    );

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Mostrando 1 de 240');
  });

  it('explica o período vazio sem sugerir que houve erro', async () => {
    request.mockResolvedValue(agenda({ upcoming: { tasks: [], total: 0, truncated: false } }));

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Nada vence neste período');
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it('mostra a falha de forma recuperável', async () => {
    request.mockRejectedValue(
      new ApiError({
        statusCode: 503,
        code: 'UNAVAILABLE',
        message: 'Serviço indisponível.',
        requestId: 'req-9',
      }),
    );

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Não foi possível carregar a agenda');
    expect(wrapper.text()).toContain('req-9');
  });
});
