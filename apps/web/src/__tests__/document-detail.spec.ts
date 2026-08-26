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
});
