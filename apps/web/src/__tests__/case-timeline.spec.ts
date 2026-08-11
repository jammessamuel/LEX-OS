import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CaseTimelineView from '../views/CaseTimelineView.vue';

const request = vi.hoisted(() => vi.fn());

vi.mock('../api/client.js', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return { ...actual, request };
});

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'caso-1' } }),
}));

const caso = { id: 'caso-1', internalCode: 'DEMO-0001', title: 'Caso fictício' };

function evento(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ev-1',
    caseId: 'caso-1',
    eventType: 'CONTRACT_SIGNED',
    title: 'Assinatura do contrato de trabalho',
    description: 'Contrato celebrado entre as partes conforme documento.',
    occurredAt: '2019-03-14T00:00:00.000Z',
    datePrecision: 'DAY',
    importance: 'HIGH',
    sourceType: 'DOCUMENT',
    sourceId: 'doc-1',
    sourceLocator: { pageNumber: 2 },
    extraction: {
      id: 'ex-1',
      provider: 'lex-os-review',
      modelName: 'deterministic-v1',
      modelVersion: null,
      promptVersion: 'timeline-v1',
      createdAt: '2026-08-06T12:00:00.000Z',
    },
    confidenceScore: 0.91,
    createdByActorType: 'AI',
    confirmedByUser: false,
    confirmedById: null,
    confirmedAt: null,
    createdAt: '2026-08-06T12:00:00.000Z',
    updatedAt: '2026-08-06T12:00:00.000Z',
    ...overrides,
  };
}

function page(data: unknown[]) {
  return { data, pageInfo: { nextCursor: null, hasNextPage: false } };
}

function mockList(...eventos: unknown[]): void {
  request.mockImplementation(async (path: string, options?: { method?: string }) => {
    if (options?.method === 'POST') {
      throw new Error('POST inesperado neste mock');
    }
    return path.includes('/timeline-events') ? page(eventos) : caso;
  });
}

const stubs = { RouterLink: { template: '<a><slot /></a>' } };

describe('CaseTimelineView', () => {
  beforeEach(() => {
    request.mockReset();
  });

  it('evento de IA não confirmado tem nota de origem e botão de confirmar', async () => {
    mockList(evento());
    const wrapper = mount(CaseTimelineView, { global: { stubs } });
    await flushPromises();

    const text = wrapper.text();
    expect(text).toContain('Assinatura do contrato de trabalho');
    expect(text).toContain('14/03/2019');
    expect(text).toContain('Aguardando revisão');
    expect(text).toContain('Alta');

    const mark = wrapper.get('.prov');
    const tooltip = wrapper.get(`[id="${mark.attributes('aria-describedby')}"]`).text();
    expect(tooltip).toContain('lex-os-review');
    expect(tooltip).toContain('confiança 91%');
    expect(tooltip).toContain('página 2');

    expect(text).not.toContain('CONTRACT_SIGNED');
    expect(text).not.toContain('HIGH');
    expect(text).not.toContain('AI');
  });

  it('confirmar troca o evento pelo retorno do servidor: chip vira Confirmado, botão some', async () => {
    mockList(evento());
    const wrapper = mount(CaseTimelineView, { global: { stubs } });
    await flushPromises();

    const confirmado = evento({
      confirmedByUser: true,
      confirmedById: 'user-1',
      confirmedAt: '2026-08-07T10:00:00.000Z',
    });
    request.mockImplementationOnce(async () => confirmado);

    await wrapper.get('.event__review button').trigger('click');
    await flushPromises();

    expect(request).toHaveBeenLastCalledWith('/timeline-events/ev-1/confirm', { method: 'POST' });
    const text = wrapper.text();
    expect(text).toContain('Confirmado');
    expect(text).not.toContain('Aguardando revisão');
    expect(wrapper.find('.event__review button').exists()).toBe(false);
    // Confirmado perde o marcador de procedência: o valor passa a peso pleno.
    expect(wrapper.find('.prov').exists()).toBe(false);
  });

  it('quando outra pessoa confirmou primeiro (409), recarrega e mostra o estado real', async () => {
    mockList(evento());
    const wrapper = mount(CaseTimelineView, { global: { stubs } });
    await flushPromises();

    const { ApiError } = await import('../api/client');
    request.mockImplementationOnce(async () => {
      throw new ApiError({
        statusCode: 409,
        code: 'TIMELINE_EVENT_ALREADY_CONFIRMED',
        message: 'O evento já foi confirmado por uma pessoa.',
      });
    });
    mockList(evento({ confirmedByUser: true, confirmedAt: '2026-08-07T09:00:00.000Z' }));

    await wrapper.get('.event__review button').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Confirmado');
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it('a data respeita a precisão registrada em vez de inventar certeza', async () => {
    mockList(
      evento({ id: 'ev-mes', datePrecision: 'MONTH', occurredAt: '2019-03-14T00:00:00.000Z' }),
      evento({ id: 'ev-sem', datePrecision: 'UNKNOWN', occurredAt: null }),
    );
    const wrapper = mount(CaseTimelineView, { global: { stubs } });
    await flushPromises();

    const text = wrapper.text();
    expect(text).toContain('03/2019');
    expect(text).toContain('Data não identificada');
    expect(text).not.toContain('14/03/2019');
  });
});
