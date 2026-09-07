import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DocumentDetailView from '../views/DocumentDetailView.vue';
import { useSessionStore } from '../stores/session.js';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('vue-router', () => ({
  RouterLink: { props: ['to'], template: '<a><slot /></a>' },
  useRoute: () => ({ params: { id: 'doc-1' } }),
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('../api/client.js', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return { ...actual, request: mocks.request };
});

const documento = {
  id: 'doc-1',
  caseId: 'case-1',
  fileId: 'file-1',
  documentTypeId: null,
  title: 'Holerite fictício',
  description: null,
  documentDate: null,
  issuer: null,
  recipient: null,
  classificationStatus: 'PENDING',
  processingStatus: 'NEEDS_REVIEW',
  isOriginal: true,
  isSigned: null,
  isLegible: null,
  isDuplicate: false,
  file: { id: 'file-1', originalFilename: 'holerite.txt', mimeType: 'text/plain', sizeBytes: 91 },
  documentType: null,
  createdAt: '2026-08-26T12:00:00.000Z',
  updatedAt: '2026-08-26T12:00:00.000Z',
};

const paginaVazia = { data: [], pageInfo: { nextCursor: null, hasNextPage: false } };

function respostas(comCaso: boolean) {
  mocks.request.mockImplementation(async (path: string) => {
    if (path === '/documents/doc-1') return documento;
    if (path === '/documents/doc-1/extractions') return paginaVazia;
    if (path === '/cases/case-1') {
      if (!comCaso) throw new Error('caso indisponível');
      return { id: 'case-1', internalCode: 'RT-2026-0007', cnjNumber: '0009999-84.2026.5.02.0001' };
    }
    throw new Error(`Rota inesperada: ${path}`);
  });
}

describe('DocumentDetailView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useSessionStore().$patch({ permissions: new Set(['documents.read']) });
    mocks.request.mockReset();
  });

  it('nomeia o processo no breadcrumb, em vez da palavra "caso"', async () => {
    respostas(true);
    const wrapper = mount(DocumentDetailView);
    await flushPromises();

    const crumb = wrapper.get('.crumb').text();
    // O advogado navega entre vários processos; um rótulo genérico não identifica nada.
    expect(crumb).toContain('0009999-84.2026.5.02.0001');
    expect(crumb).not.toMatch(/\bcaso\b/u);
  });

  it('cai no rótulo genérico quando o caso não carrega, sem derrubar o documento', async () => {
    respostas(false);
    const wrapper = mount(DocumentDetailView);
    await flushPromises();

    expect(wrapper.get('.crumb').text()).toContain('caso');
    expect(wrapper.text()).toContain('Holerite fictício');
  });

  /**
   * Os dois avisos abaixo saem de `structuredData`, que o contrato entrega como `unknown` porque
   * o formato muda por etapa. O pipeline grava os dois campos desde 2026-09-06 e nenhuma tela os
   * lia — dado gravado que ninguém mostra é o mesmo que dado ausente para quem trabalha.
   */
  function comExtracoes(extracoes: unknown[]) {
    mocks.request.mockImplementation(async (path: string) => {
      if (path === '/documents/doc-1') return documento;
      if (path === '/documents/doc-1/extractions') {
        return { data: extracoes, pageInfo: { nextCursor: null, hasNextPage: false } };
      }
      if (path === '/cases/case-1') {
        return {
          id: 'case-1',
          internalCode: 'RT-2026-0007',
          cnjNumber: '0009999-84.2026.5.02.0001',
        };
      }
      throw new Error(`Rota inesperada: ${path}`);
    });
  }

  const extracao = (tipo: string, structuredData: unknown) => ({
    id: `ex-${tipo}`,
    extractionType: tipo,
    provider: 'lex-os-mock',
    modelName: 'deterministic-v1',
    confidenceScore: 0.9,
    createdAt: '2026-09-07T10:00:00.000Z',
    structuredData,
  });

  it('avisa que o arquivo reúne mais de um documento, em vez de só classificá-lo', async () => {
    // Composto e "não sei que documento é este" chegavam iguais à tela, e pedem coisas opostas:
    // um manda separar o arquivo antes de qualquer conferência, o outro manda conferir o tipo.
    comExtracoes([extracao('CLASSIFICATION', { documentTypeCode: 'CONTRATO', composite: true })]);
    const wrapper = mount(DocumentDetailView);
    await flushPromises();

    expect(wrapper.text()).toContain('reúne mais de um documento');
    expect(wrapper.text()).toContain('Separe os documentos antes de conferir');
  });

  it('não inventa o aviso de composto quando a procedência não traz o campo', async () => {
    // Extração antiga, gravada antes de o campo existir. Ausência não é `true`.
    comExtracoes([extracao('CLASSIFICATION', { documentTypeCode: 'CONTRATO' })]);
    const wrapper = mount(DocumentDetailView);
    await flushPromises();

    expect(wrapper.text()).not.toContain('reúne mais de um documento');
  });

  it('distingue documento ilegível de documento sem fato datado', async () => {
    // Os dois produzem cronologia vazia. Sem este aviso, o escritório lê "não há datas aqui"
    // quando o certo é "a imagem não deixou ler as datas" — e a saída de cada um é outra.
    comExtracoes([extracao('TIMELINE_ANALYSIS', { eventCount: 0, outcome: 'UNREADABLE' })]);
    const wrapper = mount(DocumentDetailView);
    await flushPromises();

    expect(wrapper.text()).toContain('não conseguiu ler este documento');
  });

  it('cala sobre legibilidade quando a análise leu o documento e não achou data', async () => {
    comExtracoes([extracao('TIMELINE_ANALYSIS', { eventCount: 0, outcome: 'ANALYZED' })]);
    const wrapper = mount(DocumentDetailView);
    await flushPromises();

    expect(wrapper.text()).not.toContain('não conseguiu ler este documento');
  });
});
