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
    expect(wrapper.text()).toContain('Nenhuma afirmação foi inventada');
  });
});
