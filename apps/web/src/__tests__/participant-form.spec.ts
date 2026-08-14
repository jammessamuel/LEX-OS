import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ParticipantForm from '../components/ParticipantForm.vue';
import { useSessionStore } from '../stores/session.js';

const request = vi.hoisted(() => vi.fn());

vi.mock('../api/client.js', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return { ...actual, request };
});

const person = {
  id: 'person-1',
  personType: 'INDIVIDUAL',
  fullName: 'Pessoa Fictícia',
  tradeName: null,
  cpf: null,
  cnpj: null,
  rg: null,
  birthDate: null,
  email: null,
  phone: null,
  occupation: null,
  maritalStatus: null,
  createdAt: '2026-08-13T12:00:00.000Z',
  updatedAt: '2026-08-13T12:00:00.000Z',
};

const participant = {
  id: 'participant-1',
  caseId: 'case-1',
  role: 'reclamante',
  side: 'polo_ativo',
  isClient: true,
  person,
  createdAt: '2026-08-13T12:00:00.000Z',
  updatedAt: '2026-08-13T12:00:00.000Z',
};

describe('ParticipantForm', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    request.mockReset();
  });

  it('associa uma pessoa existente com papel, polo e vínculo de cliente', async () => {
    request.mockImplementation(async (path: string) => {
      if (path === '/persons') {
        return { data: [person], pageInfo: { nextCursor: null, hasNextPage: false } };
      }
      if (path === '/cases/case-1/participants') return participant;
      throw new Error(`Rota inesperada: ${path}`);
    });
    const wrapper = mount(ParticipantForm, { props: { caseId: 'case-1' } });
    await flushPromises();

    await wrapper.get('select').setValue('person-1');
    const selects = wrapper.findAll('select');
    const roleSelect = selects.at(1);
    const sideSelect = selects.at(2);
    expect(roleSelect).toBeDefined();
    expect(sideSelect).toBeDefined();
    await roleSelect?.setValue('reclamante');
    await sideSelect?.setValue('polo_ativo');
    await wrapper.get('input[type="checkbox"]').setValue(true);
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(request).toHaveBeenCalledWith('/cases/case-1/participants', {
      method: 'POST',
      body: {
        personId: 'person-1',
        role: 'reclamante',
        side: 'polo_ativo',
        isClient: true,
      },
    });
    expect(wrapper.emitted('created')?.[0]).toEqual([participant]);
  });

  it('cadastra uma pessoa mínima antes de associá-la quando autorizado', async () => {
    useSessionStore().$patch({ permissions: new Set(['persons.manage']) });
    request.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === '/persons' && options?.method !== 'POST') {
        return { data: [], pageInfo: { nextCursor: null, hasNextPage: false } };
      }
      if (path === '/persons' && options?.method === 'POST') return person;
      if (path === '/cases/case-1/participants') return participant;
      throw new Error(`Rota inesperada: ${path}`);
    });
    const wrapper = mount(ParticipantForm, { props: { caseId: 'case-1' } });
    await flushPromises();

    await wrapper.get('#participant-person-name').setValue('Pessoa Fictícia');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(request).toHaveBeenCalledWith('/persons', {
      method: 'POST',
      body: {
        personType: 'INDIVIDUAL',
        fullName: 'Pessoa Fictícia',
        tradeName: null,
      },
    });
    expect(request).toHaveBeenCalledWith(
      '/cases/case-1/participants',
      expect.objectContaining({ body: expect.objectContaining({ personId: 'person-1' }) }),
    );
  });
});
