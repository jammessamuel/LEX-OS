import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PreparationStatus from '../components/PreparationStatus.vue';

const request = vi.hoisted(() => vi.fn());

vi.mock('../api/client.js', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return { ...actual, request };
});

function job(documentId: string, jobType: string, status: string) {
  return { id: `${documentId}-${jobType}`, documentId, jobType, status, caseId: 'caso-1' };
}

const emptyPage = { data: [], pageInfo: { nextCursor: null, hasNextPage: false } };

/** Uma rodada de polling são três chamadas: QUEUED, PROCESSING e RETRYING. */
function mockRound(jobs: ReturnType<typeof job>[]): void {
  request.mockImplementationOnce(async () => ({
    ...emptyPage,
    data: jobs.filter((j) => j.status === 'QUEUED'),
  }));
  request.mockImplementationOnce(async () => ({
    ...emptyPage,
    data: jobs.filter((j) => j.status === 'PROCESSING'),
  }));
  request.mockImplementationOnce(async () => ({
    ...emptyPage,
    data: jobs.filter((j) => j.status === 'RETRYING'),
  }));
}

describe('PreparationStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    request.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mostra a frase de preparo em linguagem simples e sem termo técnico', async () => {
    mockRound([job('doc-1', 'OCR', 'PROCESSING'), job('doc-2', 'FILE_VALIDATION', 'QUEUED')]);

    const wrapper = mount(PreparationStatus, { props: { caseId: 'caso-1' } });
    await flushPromises();

    const text = wrapper.get('[role="status"]').text();
    expect(text).toContain('Preparando 2 documentos');
    expect(text).toContain('Pode fechar esta página');
    expect(text).not.toMatch(/OCR|job|pipeline/iu);
  });

  it('entrega a etapa por documento como verbo do dia a dia', async () => {
    mockRound([job('doc-1', 'OCR', 'PROCESSING')]);

    const wrapper = mount(PreparationStatus, { props: { caseId: 'caso-1' } });
    await flushPromises();

    const emitted = wrapper.emitted('stages');
    expect(emitted).toBeTruthy();
    const map = emitted?.at(-1)?.[0] as ReadonlyMap<string, string>;
    expect(map.get('doc-1')).toBe('Extraindo texto');
  });

  it('avisa quando algo termina, some da tela e para de perguntar', async () => {
    mockRound([job('doc-1', 'OCR', 'PROCESSING')]);
    const wrapper = mount(PreparationStatus, { props: { caseId: 'caso-1' } });
    await flushPromises();
    expect(wrapper.find('[role="status"]').exists()).toBe(true);

    // Próxima rodada: nada ativo. O componente emite settled e desliga o polling.
    mockRound([]);
    await vi.advanceTimersByTimeAsync(2_500);
    await flushPromises();

    expect(wrapper.emitted('settled')).toHaveLength(1);
    expect(wrapper.find('[role="status"]').exists()).toBe(false);

    const callsAfterSettled = request.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    await flushPromises();
    expect(request.mock.calls.length).toBe(callsAfterSettled);
  });

  it('wake() reinicia o acompanhamento depois de um envio novo', async () => {
    mockRound([]);
    const wrapper = mount(PreparationStatus, { props: { caseId: 'caso-1' } });
    await flushPromises();
    expect(wrapper.find('[role="status"]').exists()).toBe(false);

    mockRound([job('doc-9', 'FILE_VALIDATION', 'QUEUED')]);
    (wrapper.vm as unknown as { wake: () => void }).wake();
    await flushPromises();

    expect(wrapper.get('[role="status"]').text()).toContain('Preparando 1 documento');
  });
});
