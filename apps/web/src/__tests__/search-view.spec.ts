import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client.js';
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

  it('mostra a espera enquanto a resposta é produzida, e não a tela parada', async () => {
    // A resposta levou de 1,4 a 18,8 segundos nas medições de 2026-09-07, e a espera existia só
    // como rótulo de botão. Dezoito segundos de tela parada quebram uma apresentação.
    let liberar = (): void => {};
    request.mockImplementation(async (path: string) => {
      if (path === '/cases') {
        return {
          data: [{ id: 'case-1', internalCode: 'DEMO-1', title: 'Caso fictício' }],
          pageInfo: { nextCursor: null, hasNextPage: false },
        };
      }
      await new Promise<void>((resolve) => {
        liberar = resolve;
      });
      return {
        status: 'ANSWER',
        machineGenerated: true,
        disclaimer: 'Exige revisão humana.',
        answer: 'Resposta ancorada.',
        claims: [{ text: 'Afirmação sustentada.', citations: [citation] }],
        model: null,
        refusalReason: null,
      };
    });
    const wrapper = mountView();
    await flushPromises();
    await wrapper.get('textarea').setValue('pergunta que demora');
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Responder'))
      ?.trigger('click');
    await flushPromises();

    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(true);
    expect(wrapper.findAll('.skeleton').length).toBeGreaterThan(0);
    expect(wrapper.text()).toContain('Lendo os trechos autorizados');

    liberar();
    await flushPromises();

    // E a espera some quando o conteúdo chega, em vez de conviver com ele.
    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('Afirmação sustentada');
  });

  it('oferece perguntar novamente quando a saída do modelo é descartada', async () => {
    // A saída sem apoio é descartada de propósito, e a falha é passageira: em 2026-09-07 as duas
    // perguntas que haviam falhado saíram inteiras nas dez tentativas seguintes. Sem este botão o
    // leitor fica num beco — a pergunta continua no campo e nada diz que vale insistir. Numa
    // apresentação a escritório, é a diferença entre um tropeço e o fim da demonstração.
    request.mockImplementation(async (path: string) => {
      if (path === '/cases') {
        return {
          data: [{ id: 'case-1', internalCode: 'DEMO-1', title: 'Caso fictício' }],
          pageInfo: { nextCursor: null, hasNextPage: false },
        };
      }
      throw new ApiError({
        statusCode: 502,
        code: 'INVALID_LANGUAGE_MODEL_OUTPUT',
        message: 'A resposta não veio em forma utilizável e foi descartada.',
        requestId: 'req-1',
      });
    });
    const wrapper = mountView();
    await flushPromises();
    await wrapper.get('textarea').setValue('pergunta cuja saída é descartada');
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Responder'))
      ?.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Não foi possível concluir');
    // Vocabulário interno não chega ao escritório: nem o código, nem "provedor", nem "ancoragem".
    expect(wrapper.text()).not.toContain('INVALID_LANGUAGE_MODEL_OUTPUT');

    const repetir = wrapper.findAll('button').find((b) => b.text() === 'Perguntar novamente');
    expect(repetir).toBeDefined();

    // E o botão pergunta de novo de verdade, em vez de só existir.
    const antes = request.mock.calls.filter((c) => c[0] === '/assistant/answers').length;
    await repetir?.trigger('click');
    await flushPromises();
    expect(request.mock.calls.filter((c) => c[0] === '/assistant/answers').length).toBe(antes + 1);
  });

  it('não oferece repetir quando insistir não muda o resultado', async () => {
    // Regra 4 do `ui-harness.md`: botão que não faz nada reprova a revisão. Pergunta curta demais
    // continua curta na segunda tentativa.
    const wrapper = mountView();
    await flushPromises();
    await wrapper.get('textarea').setValue('a');
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Responder'))
      ?.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Escreva pelo menos dois caracteres');
    expect(wrapper.findAll('button').some((b) => b.text() === 'Perguntar novamente')).toBe(false);
  });
});
