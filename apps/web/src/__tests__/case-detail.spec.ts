import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CaseDetailView from '../views/CaseDetailView.vue';

const request = vi.hoisted(() => vi.fn());

vi.mock('../api/client.js', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return { ...actual, request };
});

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'case-1' } }),
}));

const { ApiError } = await import('../api/client');

const legalCase = {
  id: 'case-1',
  internalCode: 'DEMO-0001',
  title: 'Caso fictício de demonstração',
  description: null,
  legalArea: 'DIREITO_TRABALHISTA',
  caseType: 'RECLAMACAO_TRABALHISTA',
  status: 'UNDER_ANALYSIS' as const,
  priority: 'NORMAL' as const,
  confidentialityLevel: 'STANDARD' as const,
  responsibleUserId: 'user-1',
  responsible: { id: 'user-1', name: 'Dra. Ana Responsável' },
  openedAt: '2026-08-05T12:00:00.000Z',
  closedAt: null,
  createdAt: '2026-08-05T12:00:00.000Z',
  updatedAt: '2026-08-05T12:00:00.000Z',
};

function document(id: string, title: string) {
  return {
    id,
    caseId: 'case-1',
    fileId: `file-${id}`,
    documentTypeId: null,
    title,
    description: null,
    documentDate: null,
    issuer: null,
    recipient: null,
    classificationStatus: 'PENDING',
    processingStatus: 'PENDING',
    isOriginal: true,
    isSigned: null,
    isLegible: null,
    isDuplicate: false,
    file: {
      filename: `${id}.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: 2048,
      virusScanStatus: 'CLEAN',
      status: 'AVAILABLE',
    },
    documentType: null,
    createdAt: '2026-08-05T12:00:00.000Z',
    updatedAt: '2026-08-05T12:00:00.000Z',
  };
}

function participant(id: string, name: string) {
  return {
    id,
    caseId: 'case-1',
    role: 'reclamante' as const,
    side: 'polo_ativo' as const,
    isClient: true,
    person: {
      id: `person-${id}`,
      personType: 'INDIVIDUAL' as const,
      fullName: name,
      tradeName: null,
    },
    createdAt: '2026-08-05T12:00:00.000Z',
    updatedAt: '2026-08-05T12:00:00.000Z',
  };
}

const emptyPage = { data: [], pageInfo: { nextCursor: null, hasNextPage: false } };

function mountView() {
  return mount(CaseDetailView, {
    global: {
      stubs: {
        FileIntakePanel: { template: '<div />' },
        PreparationStatus: { template: '<div />' },
        RouterLink: { template: '<a><slot /></a>' },
      },
    },
  });
}

describe('CaseDetailView', () => {
  beforeEach(() => {
    request.mockReset();
  });

  it('mostra o nome do responsável sem expor UUID ou rótulo genérico', async () => {
    request.mockImplementation(async (path: string) =>
      path === '/cases/case-1' ? legalCase : emptyPage,
    );

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Dra. Ana Responsável');
    expect(wrapper.text()).not.toContain('Atribuído');
    expect(wrapper.text()).not.toContain('user-1');
  });

  it('explica quando o caso não tem responsável', async () => {
    request.mockImplementation(async (path: string) =>
      path === '/cases/case-1'
        ? { ...legalCase, responsibleUserId: null, responsible: null }
        : emptyPage,
    );

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Sem responsável');
  });

  it('mantém o caso e as partes legíveis quando só o painel de documentos falha', async () => {
    let documentAttempts = 0;
    request.mockImplementation(async (path: string) => {
      if (path === '/cases/case-1') return legalCase;
      if (path.endsWith('/documents')) {
        documentAttempts += 1;
        if (documentAttempts === 1) {
          throw new ApiError({
            statusCode: 503,
            code: 'SERVICE_UNAVAILABLE',
            message: 'Documentos temporariamente indisponíveis.',
            requestId: 'req-docs',
          });
        }
        return {
          data: [document('doc-1', 'Contrato de trabalho')],
          pageInfo: { nextCursor: null, hasNextPage: false },
        };
      }
      return {
        data: [participant('part-1', 'Maria da Silva')],
        pageInfo: { nextCursor: null, hasNextPage: false },
      };
    });

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Caso fictício de demonstração');
    expect(wrapper.text()).toContain('Maria da Silva');
    expect(wrapper.get('[data-test="documents-failure"]').text()).toContain(
      'Documentos temporariamente indisponíveis.',
    );
    expect(wrapper.text()).not.toContain('Nenhum documento neste caso');

    await wrapper.get('[data-test="documents-failure"] button').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-test="documents-failure"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('Contrato de trabalho');
  });

  it('pagina documentos e partes de forma independente sem substituir o que já foi lido', async () => {
    request.mockImplementation(async (path: string, options?: { query?: { cursor?: string } }) => {
      if (path === '/cases/case-1') return legalCase;
      if (path.endsWith('/documents')) {
        return options?.query?.cursor === 'docs-2'
          ? {
              data: [document('doc-2', 'Procuração')],
              pageInfo: { nextCursor: null, hasNextPage: false },
            }
          : {
              data: [document('doc-1', 'Contrato de trabalho')],
              pageInfo: { nextCursor: 'docs-2', hasNextPage: true },
            };
      }
      if (path.endsWith('/participants')) {
        return options?.query?.cursor === 'parts-2'
          ? {
              data: [participant('part-2', 'Empresa Fictícia Ltda.')],
              pageInfo: { nextCursor: null, hasNextPage: false },
            }
          : {
              data: [participant('part-1', 'Maria da Silva')],
              pageInfo: { nextCursor: 'parts-2', hasNextPage: true },
            };
      }
      return emptyPage;
    });

    const wrapper = mountView();
    await flushPromises();

    const moreDocuments = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Carregar mais documentos');
    expect(moreDocuments).toBeDefined();
    await moreDocuments?.trigger('click');
    await flushPromises();

    const moreParticipants = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Carregar mais partes');
    expect(moreParticipants).toBeDefined();
    await moreParticipants?.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Contrato de trabalho');
    expect(wrapper.text()).toContain('Procuração');
    expect(wrapper.text()).toContain('Maria da Silva');
    expect(wrapper.text()).toContain('Empresa Fictícia Ltda.');
    expect(wrapper.text()).toContain('2 carregados');
    expect(wrapper.text()).toContain('2 carregadas');
  });
});
