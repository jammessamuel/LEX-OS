import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DashboardView from '../views/DashboardView.vue';

const request = vi.hoisted(() => vi.fn());

vi.mock('../api/client.js', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return { ...actual, request };
});

describe('DashboardView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    request.mockReset();
  });

  it('prioriza trabalho pendente sem expor vocabulário técnico', async () => {
    request.mockResolvedValue({
      cases: { total: 8, open: 6, highPriority: 2, processingLimitReached: 1 },
      documents: { total: 20, processing: 3, needsReview: 4, failed: 1 },
      tasks: { open: 5, overdue: 2 },
      processing: { active: 3, failed: 1 },
      asOf: '2026-08-13T12:00:00.000Z',
    });

    const wrapper = mount(DashboardView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    });
    await flushPromises();

    const text = wrapper.text();
    expect(text).toContain('6');
    expect(text).toContain('4');
    expect(text).toContain('5 prazos em aberto');
    expect(text).not.toContain('NEEDS_REVIEW');
    expect(text).not.toContain('LIMIT_REACHED');
  });
});
