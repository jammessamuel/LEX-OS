import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DocumentDetailView from '../views/DocumentDetailView.vue';
import { useSessionStore } from '../stores/session.js';

const request = vi.hoisted(() => vi.fn());

vi.mock('../api/client.js', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return { ...actual, request };
});

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'doc-1' } }),
  useRouter: () => ({ replace: vi.fn() }),
}));

const documento = {
  id: 'doc-1',
  caseId: 'caso-1',
  title: 'Contrato de trabalho',
  processingStatus: 'NEEDS_REVIEW',
  classificationStatus: 'PENDING',
  isDuplicate: false,
  file: { filename: 'contrato.pdf', sizeBytes: 2048, mimeType: 'application/pdf' },
  documentType: { id: 't1', code: 'CONTRATO', name: 'Contrato', category: 'CONTRATUAL' },
};

const extracoes = {
  data: [
    {
      id: 'ex-2',
      documentId: 'doc-1',
      extractionType: 'ENTITY_EXTRACTION',
      provider: 'lex-os-mock-entities',
      modelName: 'deterministic-v1',
      executionId: 'mock-v1:job-2',
      status: 'COMPLETED',
      rawText: null,
      confidenceScore: 0.98,
      createdAt: '2026-08-06T12:05:00.000Z',
      entities: [
        {
          id: 'en-1',
          entityType: 'CONTRACT_NUMBER',
          normalizedValue: 'LEX-2026-0001',
          originalValue: 'LEX-2026-0001',
          pageNumber: 1,
          startOffset: 19,
          endOffset: 32,
          confidenceScore: 0.99,
          linkedPersonId: null,
          metadata: {},
          confirmedByUser: false,
          confirmedById: null,
          confirmedAt: null,
          createdAt: '2026-08-06T12:05:00.000Z',
        },
        {
          id: 'en-2',
          entityType: 'DATE',
          normalizedValue: '2026-08-05',
          originalValue: '05/08/2026',
          pageNumber: 1,
          startOffset: 47,
          endOffset: 57,
          confidenceScore: 0.98,
          linkedPersonId: null,
          metadata: {},
          confirmedByUser: false,
          confirmedById: null,
          confirmedAt: null,
          createdAt: '2026-08-06T12:05:00.000Z',
        },
      ],
    },
    {
      id: 'ex-1',
      documentId: 'doc-1',
      extractionType: 'OCR',
      provider: 'lex-os-mock-ocr',
      modelName: 'deterministic-v1',
      executionId: 'mock-v1:job-1',
      status: 'COMPLETED',
      rawText: 'Contrato fictício LEX-2026-0001, celebrado em 05/08/2026.',
      confidenceScore: 0.97,
      createdAt: '2026-08-06T12:04:00.000Z',
      entities: [],
    },
  ],
  pageInfo: { nextCursor: null, hasNextPage: false },
};

function mockLoads(): void {
  request.mockImplementation(async (path: string) => {
    if (path.includes('/extracted-entities/')) {
      const entity = extracoes.data.at(0)?.entities.find((item) => path.includes(item.id));
      if (entity === undefined) {
        throw new Error('A entidade fictícia não foi encontrada.');
      }
      return {
        ...entity,
        confirmedByUser: true,
        confirmedById: 'user-1',
        confirmedAt: '2026-08-13T12:00:00.000Z',
      };
    }
    return path.endsWith('/extractions') ? extracoes : documento;
  });
}

describe('DocumentDetailView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useSessionStore().$patch({ permissions: new Set(['documents.manage']) });
    request.mockReset();
  });

  it('todo dado identificado tem origem resolvível: arquivo, página, trecho e confiança', async () => {
    mockLoads();
    const wrapper = mount(DocumentDetailView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    });
    await flushPromises();

    const marks = wrapper.findAll('.prov');
    expect(marks).toHaveLength(2);

    // A nota é vinculada por aria-describedby e o alvo existe de fato.
    const described = marks.at(0)?.attributes('aria-describedby');
    expect(described).toBeTruthy();
    const tooltip = wrapper.get(`[id="${described}"]`).text();
    expect(tooltip).toContain('Extraído por IA · não confirmado');
    expect(tooltip).toContain('contrato.pdf');
    expect(tooltip).toContain('página 1');
    expect(tooltip).toContain('caracteres 19–32');
    expect(tooltip).toContain('confiança 99%');
    expect(tooltip).toContain('lex-os-mock-entities');
  });

  it('quando a IA normalizou o valor, a nota preserva o que estava no documento', async () => {
    mockLoads();
    const wrapper = mount(DocumentDetailView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    });
    await flushPromises();

    const dateTooltipId = wrapper.findAll('.prov').at(1)?.attributes('aria-describedby');
    expect(wrapper.get(`[id="${dateTooltipId}"]`).text()).toContain('no documento: "05/08/2026"');
  });

  it('confirma uma entidade sem perder a nota de procedência', async () => {
    mockLoads();
    const wrapper = mount(DocumentDetailView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    });
    await flushPromises();

    const confirm = wrapper.findAll('button').find((button) => button.text() === 'Confirmar');
    expect(confirm).toBeDefined();
    expect(wrapper.text()).toContain('Aguardando revisão');

    await confirm?.trigger('click');
    await flushPromises();

    expect(request).toHaveBeenCalledWith('/extracted-entities/en-1/confirm', { method: 'POST' });
    expect(wrapper.text()).toContain('Confirmado');
    expect(wrapper.findAll('.prov').at(0)?.attributes('aria-describedby')).toBeTruthy();
  });

  it('mostra o texto extraído e a trilha de execuções sem vazar rótulo técnico', async () => {
    mockLoads();
    const wrapper = mount(DocumentDetailView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    });
    await flushPromises();

    const text = wrapper.text();
    expect(text).toContain('Contrato fictício LEX-2026-0001');
    expect(text).toContain('Identificação de dados');
    expect(text).toContain('Extração de texto');
    expect(text).not.toContain('ENTITY_EXTRACTION');
    expect(text).not.toContain('NEEDS_REVIEW');
  });
});
