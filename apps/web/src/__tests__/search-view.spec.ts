import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SearchView from '../views/SearchView.vue';

const request = vi.hoisted(() => vi.fn());

vi.mock('../api/client.js', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return { ...actual, request };
});

const citation = {
  caseId: 'case-1',
  documentId: 'doc-1',
  extractionId: 'ex-1',
  pageNumber: 2,
  startOffset: 10,
  endOffset: 40,
  contentHash: 'a'.repeat(64),
};

function mountView() {
  return mount(SearchView, {
    global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
  });
}

describe('SearchView', () => {
  beforeEach(() => {
    request.mockReset();
    request.mockImplementation(async (path: string) => {
      if (path === '/cases') {
        return {
          data: [{ id: 'case-1', internalCode: 'DEMO-1', title: 'Caso fictício' }],
          pageInfo: { nextCursor: null, hasNextPage: false },
        };
      }
      return {
        status: 'RESULTS',
        mode: 'HYBRID',
        resultCount: 1,
        results: [
          {
            chunkId: 'chunk-1',
            excerpt: 'Trecho autorizado do contrato.',
            matchedBy: 'HYBRID',
            score: 1,
            citation,
          },
        ],
      };
    });
  });

  it('pesquisa dentro do caso e mostra citação navegável', async () => {
    const wrapper = mountView();
    await flushPromises();
    await wrapper.get('textarea').setValue('data do contrato');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(request).toHaveBeenCalledWith('/search', {
      method: 'POST',
      body: { query: 'data do contrato', caseId: 'case-1', mode: 'HYBRID', limit: 10 },
    });
    expect(wrapper.text()).toContain('Trecho autorizado do contrato');
    expect(wrapper.text()).toContain('página 2');
    // Como o trecho foi achado é procedência, não enfeite: a resposta ecoa o modo pedido, e sem
    // isto a tela dizia "híbrida" enquanto a metade semântica não devolvia nada.
    expect(wrapper.text()).toContain('encontrado por termos e sentido');
    expect(wrapper.text()).toContain('Abrir documento');
  });

  it('explica a recusa quando nenhuma fonte sustenta a resposta', async () => {
    request.mockImplementation(async (path: string) => {
      if (path === '/cases') {
        return {
          data: [{ id: 'case-1', internalCode: 'DEMO-1', title: 'Caso fictício' }],
          pageInfo: { nextCursor: null, hasNextPage: false },
        };
      }
      return {
        status: 'INSUFFICIENT_EVIDENCE',
        machineGenerated: true,
        disclaimer: 'Exige revisão humana.',
        answer: null,
        claims: [],
        model: null,
        refusalReason: 'NO_AUTHORIZED_SOURCE',
      };
    });
    const wrapper = mountView();
    await flushPromises();
    await wrapper.get('textarea').setValue('pergunta sem fonte');
    const answerButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Responder'));
    await answerButton?.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('recusou responder');
    expect(wrapper.text()).toContain('Nenhuma fonte autorizada');
    expect(wrapper.text()).toContain('Nenhuma afirmação foi inventada');
  });

  it('distingue a recusa por trechos examinados da recusa por falta de fonte', async () => {
    // As duas recusas mandam o leitor a lugares diferentes: uma diz que o assunto não está no
    // acervo, a outra que o acervo tem material e a pergunta é que não encontra apoio nele. Antes
    // as duas mostravam o mesmo texto, e o segundo caso nem existia — o modelo era obrigado a
    // embrulhar a recusa numa afirmação, que a tela exibia como resposta fundamentada.
    request.mockImplementation(async (path: string) => {
      if (path === '/cases') {
        return {
          data: [{ id: 'case-1', internalCode: 'DEMO-1', title: 'Caso fictício' }],
          pageInfo: { nextCursor: null, hasNextPage: false },
        };
      }
      return {
        status: 'INSUFFICIENT_EVIDENCE',
        machineGenerated: true,
        disclaimer: 'Exige revisão humana.',
        answer: null,
        claims: [],
        model: {
          provider: 'lex-os-mock-language-model',
          modelName: 'deterministic-grounded-v1',
          modelVersion: '1',
          promptVersion: '1.0.0',
          executionId: 'exec-1',
          costAmount: '0.000000',
          costCurrency: 'BRL',
        },
        refusalReason: 'SOURCES_DO_NOT_SUPPORT',
      };
    });
    const wrapper = mountView();
    await flushPromises();
    await wrapper.get('textarea').setValue('pergunta que os trechos não respondem');
    const answerButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Responder'));
    await answerButton?.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('recusou responder');
    expect(wrapper.text()).toContain('trechos recuperados foram examinados');
    expect(wrapper.text()).not.toContain('Nenhuma fonte autorizada');
  });
});
