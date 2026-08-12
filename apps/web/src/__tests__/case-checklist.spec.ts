import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CaseChecklistView from '../views/CaseChecklistView.vue';

const request = vi.hoisted(() => vi.fn());

vi.mock('../api/client.js', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return { ...actual, request };
});

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'caso-1' } }),
}));

const caso = { id: 'caso-1', internalCode: 'DEMO-0001', title: 'Caso fictício' };

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: 'it-1',
    caseChecklistId: 'cl-1',
    templateItemId: 'ti-1',
    title: 'Carteira de trabalho',
    description: null,
    isRequired: true,
    status: 'MISSING',
    documentId: null,
    validatedById: null,
    validatedAt: null,
    notes: null,
    createdAt: '2026-08-12T12:00:00.000Z',
    updatedAt: '2026-08-12T12:00:00.000Z',
    ...overrides,
  };
}

function checklist(items: unknown[]) {
  return {
    id: 'cl-1',
    caseId: 'caso-1',
    templateId: 'tp-1',
    templateVersion: 1,
    status: 'IN_PROGRESS',
    items,
    createdAt: '2026-08-12T12:00:00.000Z',
    updatedAt: '2026-08-12T12:00:00.000Z',
  };
}

const page = (data: unknown[]) => ({ data, pageInfo: { nextCursor: null, hasNextPage: false } });

function mockLoad(checklists: unknown[], templates: unknown[] = []): void {
  request.mockImplementation(async (path: string) => {
    if (path.endsWith('/checklists')) return page(checklists);
    if (path.endsWith('/checklist-templates')) return page(templates);
    return caso;
  });
}

const stubs = { RouterLink: { template: '<a><slot /></a>' } };
const mountView = () => mount(CaseChecklistView, { global: { stubs } });

describe('CaseChecklistView', () => {
  beforeEach(() => {
    request.mockReset();
  });

  it('responde primeiro o que trava o protocolo, contando só o obrigatório em falta', async () => {
    mockLoad([
      checklist([
        item(),
        item({ id: 'it-2', title: 'Comprovante', isRequired: false, status: 'MISSING' }),
        item({ id: 'it-3', title: 'Contrato', status: 'VALIDATED' }),
      ]),
    ]);

    const wrapper = mountView();
    await flushPromises();

    const verdict = wrapper.get('[role="status"]').text();
    // Duas exigências em falta, mas só uma é obrigatória — só ela trava.
    expect(verdict).toContain('1 exigência obrigatória');
    expect(verdict).toContain('em falta');
    expect(wrapper.get('[role="status"]').classes()).toContain('verdict--blocked');
  });

  it('sem obrigatória em falta, o veredito muda de tom e informa o progresso', async () => {
    mockLoad([
      checklist([
        item({ status: 'VALIDATED' }),
        item({ id: 'it-2', isRequired: false, status: 'MISSING' }),
      ]),
    ]);

    const wrapper = mountView();
    await flushPromises();

    const verdict = wrapper.get('[role="status"]');
    expect(verdict.text()).toContain('Nada obrigatório em falta');
    expect(verdict.text()).toContain('1 de 2');
    expect(verdict.classes()).toContain('verdict--clear');
  });

  it('a pendência que trava recebe faixa lateral, não só cor', async () => {
    mockLoad([checklist([item(), item({ id: 'it-2', status: 'VALIDATED' })])]);

    const wrapper = mountView();
    await flushPromises();

    const blocking = wrapper.findAll('.item--blocking');
    expect(blocking).toHaveLength(1);
    expect(blocking.at(0)?.text()).toContain('Carteira de trabalho');
  });

  it('validar troca o item pelo retorno do servidor e some com o botão', async () => {
    mockLoad([checklist([item()])]);
    const wrapper = mountView();
    await flushPromises();
    expect(wrapper.text()).toContain('Não recebido');

    request.mockImplementationOnce(async () =>
      item({ status: 'VALIDATED', validatedAt: '2026-08-12T15:00:00.000Z' }),
    );
    await wrapper.get('.item__actions .btn').trigger('click');
    await flushPromises();

    expect(request).toHaveBeenLastCalledWith('/checklist-items/it-1', {
      method: 'PATCH',
      body: { status: 'VALIDATED' },
    });
    const text = wrapper.text();
    expect(text).toContain('Validado');
    expect(text).toContain('validado em');
    expect(text).not.toContain('Não recebido');
    expect(wrapper.find('.item--blocking').exists()).toBe(false);
  });

  it('sem checklist aplicado, oferece os modelos disponíveis e explica o instantâneo', async () => {
    mockLoad(
      [],
      [{ id: 'tp-1', name: 'Trabalhista', legalArea: 'X', caseType: 'Y', version: 1, items: [] }],
    );

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Nenhum checklist aplicado');
    expect(wrapper.text()).toContain('instantâneo');
    expect(wrapper.get('.templates .btn').text()).toContain('Aplicar Trabalhista');
  });

  it('não vaza rótulo técnico da API na tela', async () => {
    mockLoad([checklist([item({ status: 'AWAITING_VALIDATION' })])]);

    const wrapper = mountView();
    await flushPromises();
    const text = wrapper.text();

    expect(text).toContain('Aguardando validação');
    expect(text).toContain('Em andamento');
    expect(text).not.toContain('AWAITING_VALIDATION');
    expect(text).not.toContain('IN_PROGRESS');
  });
});
