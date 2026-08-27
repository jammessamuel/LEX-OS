import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SecurityView from '../views/SecurityView.vue';

const request = vi.hoisted(() => vi.fn());

vi.mock('../api/client.js', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return { ...actual, request };
});

vi.mock('../stores/session.js', () => ({
  useSessionStore: () => ({ user: { name: 'Ana Fictícia', email: 'ana@escritorio.invalid' } }),
}));

const segundoFator = {
  active: true,
  requiredByOrganization: false,
  unusedRecoveryCodes: 8,
};

function respostas(silenciados: string[] = []) {
  request.mockImplementation(async (rota: string) =>
    rota === '/auth/notifications'
      ? { silenced: silenciados, silenceable: ['task-assigned', 'preparation-digest'] }
      : segundoFator,
  );
}

const mountView = () =>
  mount(SecurityView, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } });

describe('SecurityView — avisos por e-mail', () => {
  beforeEach(() => {
    request.mockReset();
  });

  it('diz o que o e-mail carrega, porque é a pergunta que decide se a pessoa desliga', async () => {
    respostas();
    const wrapper = mountView();
    await flushPromises();

    const texto = wrapper.text();
    expect(texto).toContain('código do caso');
    expect(texto).toContain('Nunca documento, nome de parte ou teor de peça');
  });

  it('mostra a falha de documento como aviso que não se desliga', async () => {
    respostas();
    const wrapper = mountView();
    await flushPromises();

    // O ADR-013 tira este da lista de silenciáveis, e a tela precisa explicar em vez de só
    // omitir: quem procura o botão tem de encontrar a razão de ele não existir.
    const texto = wrapper.text();
    expect(texto).toContain('Documento que falhou na preparação');
    expect(texto).toContain('Este não se desliga');
    // E não pode haver caixa para ele.
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(2);
  });

  it('marca como ligado o que não está silenciado', async () => {
    respostas(['task-assigned']);
    const wrapper = mountView();
    await flushPromises();

    const caixas = wrapper.findAll('input[type="checkbox"]');
    expect((caixas[0]?.element as HTMLInputElement).checked).toBe(false);
    expect((caixas[1]?.element as HTMLInputElement).checked).toBe(true);
  });

  it('manda o conjunto inteiro ao alternar, e não a mudança', async () => {
    respostas();
    const wrapper = mountView();
    await flushPromises();

    const [primeira] = wrapper.findAll('input[type="checkbox"]');
    if (primeira === undefined) {
      throw new Error('Nenhum aviso silenciável apareceu.');
    }
    request.mockResolvedValueOnce({
      silenced: ['task-assigned'],
      silenceable: ['task-assigned', 'preparation-digest'],
    });
    await primeira.trigger('change');
    await flushPromises();

    // Duas abas mandando pedidos opostos viram um problema de última escrita, e não um estado
    // que ninguém sabe reconstruir a partir de deltas.
    const chamada = request.mock.calls.at(-1) as [
      string,
      { method?: string; body?: { silenced?: string[] } },
    ];
    expect(chamada[0]).toBe('/auth/notifications');
    expect(chamada[1].method).toBe('PUT');
    expect(chamada[1].body?.silenced).toEqual(['task-assigned']);
  });

  it('falha ao carregar avisos não esconde o segundo fator, que é o motivo da tela', async () => {
    request.mockImplementation(async (rota: string) => {
      if (rota === '/auth/notifications') throw new Error('indisponível');
      return segundoFator;
    });

    const wrapper = mountView();
    await flushPromises();

    // A seção de avisos some, e o segundo fator continua respondendo: quem abriu esta tela
    // veio pela pergunta "meu acesso está protegido?", e ela não pode ficar sem resposta
    // porque uma parte secundária falhou.
    expect(wrapper.text()).not.toContain('Avisos por e-mail');
    expect(wrapper.get('[role="status"]').text()).toContain('duas provas');
  });
});
