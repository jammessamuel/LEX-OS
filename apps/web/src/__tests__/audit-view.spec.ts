import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client.js';
import AuditView from '../views/AuditView.vue';

const request = vi.hoisted(() => vi.fn());

vi.mock('../api/client.js', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return { ...actual, request };
});

describe('AuditView', () => {
  beforeEach(() => request.mockReset());

  it('mostra somente metadados compreensíveis da trilha', async () => {
    request.mockResolvedValue({
      data: [
        {
          id: 'audit-1',
          actorType: 'USER',
          actorId: 'user-1',
          actor: { id: 'user-1', name: 'Sócia Fictícia' },
          action: 'task.updated',
          entityType: 'task',
          entityId: 'task-1',
          requestId: 'req-1',
          correlationId: 'corr-1',
          processingJobId: null,
          createdAt: '2026-08-13T12:00:00.000Z',
        },
      ],
      pageInfo: { nextCursor: null, hasNextPage: false },
    });
    const wrapper = mount(AuditView);
    await flushPromises();

    expect(wrapper.text()).toContain('Sócia Fictícia');
    expect(wrapper.text()).toContain('task.updated');
    expect(wrapper.text()).toContain('corr-1');
    expect(wrapper.text()).not.toContain('old_data');
    expect(wrapper.text()).not.toContain('new_data');
  });

  it('explica a política quando o servidor nega supervisão', async () => {
    request.mockImplementationOnce(async () => {
      throw new ApiError({ statusCode: 403, code: 'FORBIDDEN', message: 'Acesso negado.' });
    });
    const wrapper = mount(AuditView);
    await flushPromises();

    expect(wrapper.text()).toContain('Acesso reservado à supervisão');
    expect(wrapper.text()).toContain('casos confidenciais');
  });
});
