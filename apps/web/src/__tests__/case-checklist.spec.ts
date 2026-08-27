import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CaseChecklistView from '../views/CaseChecklistView.vue';
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

// As rotas de checklist devolvem o array completo, sem envelope de cursor — o mock segue o
// contrato real da API para o teste não validar um formato que o servidor nunca envia.
function mockLoad(checklists: unknown[], templates: unknown[] = []): void {
  request.mockImplementation(async (path: string) => {
    if (path.endsWith('/checklists')) return checklists;
    if (path.endsWith('/checklist-templates')) return templates;
    return caso;
  });
}

const stubs = { RouterLink: { template: '<a><slot /></a>' } };
const mountView = () => mount(CaseChecklistView, { global: { stubs } });

describe('CaseChecklistView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useSessionStore().$patch({
      permissions: new Set(['cases.update', 'tasks.manage', 'tasks.read']),
    });
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

  it('conta como travado o obrigatório ilegível, inválido ou vencido', async () => {
    // A regressão que isto guarda: quando a análise passou a propor cinco estados, o contador
    // continuou somando só MISSING. Documento obrigatório ilegível sumia da conta, e o caso
    // aparecia mais completo do que estava — numa tela cuja função é dizer o que falta.
    for (const status of ['ILLEGIBLE', 'INVALID', 'EXPIRED']) {
      request.mockReset();
      mockLoad([checklist([item({ status, documentId: 'doc-1' })])]);

      const wrapper = mountView();
      await flushPromises();

      const verdict = wrapper.get('[role="status"]');
      expect(verdict.text(), status).toContain('1 exigência obrigatória');
      expect(verdict.classes(), status).toContain('verdict--blocked');
    }
  });

  it('mostra ilegível com a cor de pendência, não com a de resolvido', async () => {
    mockLoad([checklist([item({ status: 'ILLEGIBLE', documentId: 'doc-1' })])]);

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Ilegível');
    // Os três estados novos caíam no default da função de tom e saíam neutros, que na tela lê
    // como coisa resolvida.
    expect(wrapper.html()).toContain('rejeitado');
  });

  it('deixa recusar dizendo o defeito, porque cada defeito muda o pedido ao cliente', async () => {
    mockLoad([checklist([item({ status: 'AWAITING_VALIDATION', documentId: 'doc-1' })])]);

    const wrapper = mountView();
    await flushPromises();

    const [recusar] = wrapper.findAll('button').filter((botao) => botao.text() === 'Recusar');
    if (recusar === undefined) {
      throw new Error('A exigência com documento vinculado não ofereceu recusa.');
    }
    await recusar.trigger('click');

    const texto = wrapper.text();
    expect(texto).toContain('Ilegível');
    expect(texto).toContain('Inválido');
    expect(texto).toContain('Vencido');
    // O critério vai junto do rótulo: escolher errado aqui manda o pedido errado ao cliente.
    expect(texto).toContain('novo escaneamento');

    request.mockResolvedValueOnce({
      ...item({ status: 'ILLEGIBLE', documentId: 'doc-1' }),
    });
    const [ilegivel] = wrapper
      .findAll('.recusa__opcao')
      .filter((botao) => botao.text().includes('Ilegível'));
    if (ilegivel === undefined) {
      throw new Error('A opção Ilegível não apareceu entre os motivos de recusa.');
    }
    await ilegivel.trigger('click');
    await flushPromises();

    expect(request).toHaveBeenCalledWith('/checklist-items/it-1', {
      method: 'PATCH',
      body: { status: 'ILLEGIBLE' },
    });
  });

  it('não oferece recusa sem documento vinculado, que a API recusaria', async () => {
    // `documentRequiredStatuses` na API exige documento para ilegível, inválido e vencido.
    // Oferecer o botão sem documento produziria um 400 que o advogado não tem como resolver.
    mockLoad([checklist([item({ status: 'MISSING', documentId: null })])]);

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.findAll('button').some((b) => b.text() === 'Recusar')).toBe(false);
  });

  it('oferece criar tarefa para todo estado que a API considera pendente', async () => {
    for (const status of ['MISSING', 'ILLEGIBLE', 'INVALID', 'EXPIRED']) {
      request.mockReset();
      mockLoad([checklist([item({ status, documentId: status === 'MISSING' ? null : 'doc-1' })])]);

      const wrapper = mountView();
      await flushPromises();

      const tem = wrapper.findAll('button').some((b) => b.text().includes('Criar tarefa'));
      expect({ status, tem }).toEqual({ status, tem: true });
    }
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

  it('não oferece mutações para um perfil somente leitura', async () => {
    useSessionStore().clear();
    mockLoad([checklist([item()])]);

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Não recebido');
    expect(wrapper.find('.item__actions button').exists()).toBe(false);
  });
});
