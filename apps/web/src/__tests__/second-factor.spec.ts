import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client.js';
import SecurityView from '../views/SecurityView.vue';

const request = vi.hoisted(() => vi.fn());

vi.mock('../api/client.js', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return { ...actual, request };
});

vi.mock('../stores/session.js', () => ({
  useSessionStore: () => ({ user: { name: 'Ana Fictícia', email: 'ana@escritorio.invalid' } }),
}));

const status = (overrides: Record<string, unknown> = {}) => ({
  active: false,
  requiredByOrganization: false,
  unusedRecoveryCodes: 0,
  ...overrides,
});

const stubs = { RouterLink: { template: '<a><slot /></a>' } };
const mountView = () => mount(SecurityView, { global: { stubs } });

describe('SecurityView', () => {
  beforeEach(() => {
    request.mockReset();
  });

  it('responde primeiro se o acesso está protegido, e alarma quando não está', async () => {
    request.mockResolvedValue(status());

    const wrapper = mountView();
    await flushPromises();

    const verdict = wrapper.get('[role="status"]');
    expect(verdict.text()).toContain('depende só da senha');
    expect(verdict.text()).toContain('entra no acervo do escritório');
    expect(verdict.classes()).toContain('verdict--alert');
  });

  it('não alarma quem já ativou', async () => {
    request.mockResolvedValue(status({ active: true, unusedRecoveryCodes: 10 }));

    const wrapper = mountView();
    await flushPromises();

    const verdict = wrapper.get('[role="status"]');
    expect(verdict.text()).toContain('pede duas provas');
    expect(verdict.classes()).not.toContain('verdict--alert');
  });

  it('mostra a chave em grupos legíveis e não ativa sem o código', async () => {
    request.mockResolvedValueOnce(status());
    const wrapper = mountView();
    await flushPromises();

    request.mockResolvedValueOnce({
      secret: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
      uri: 'otpauth://totp/LEX%20OS:ana@escritorio.invalid?secret=ABCD',
    });
    await wrapper.get('.actions .btn').trigger('click');
    await flushPromises();

    // Trinta e dois caracteres seguidos ninguém digita sem errar.
    expect(wrapper.get('.secret').text()).toBe('ABCD EFGH IJKL MNOP QRST UVWX YZ23 4567');
    expect(wrapper.get('a.link').attributes('href')).toContain('otpauth://');
    // Sem código, o botão de ativar não age.
    expect(wrapper.get('.actions .btn').attributes('disabled')).toBeDefined();
  });

  it('mostra os códigos de recuperação uma vez, avisando que não voltam', async () => {
    request.mockResolvedValueOnce(status());
    const wrapper = mountView();
    await flushPromises();

    request.mockResolvedValueOnce({ secret: 'ABCDEFGH', uri: 'otpauth://x' });
    await wrapper.get('.actions .btn').trigger('click');
    await flushPromises();

    request
      .mockResolvedValueOnce({ recoveryCodes: ['AAAAA-11111', 'BBBBB-22222'] })
      .mockResolvedValueOnce(status({ active: true, unusedRecoveryCodes: 2 }));
    await wrapper.get('#code').setValue('123456');
    await wrapper.get('.actions .btn').trigger('click');
    await flushPromises();

    const text = wrapper.text();
    expect(text).toContain('AAAAA-11111');
    expect(text).toContain('não aparecem de novo');
    expect(text).toContain('fora deste computador');

    await wrapper.get('.issued .btn').trigger('click');
    expect(wrapper.text()).not.toContain('AAAAA-11111');
  });

  it('exige um código para desligar, porque a sessão sozinha não prova posse', async () => {
    request.mockResolvedValue(status({ active: true, unusedRecoveryCodes: 10 }));
    const wrapper = mountView();
    await flushPromises();

    await wrapper.get('.actions .btn--ghost').trigger('click');
    expect(wrapper.text()).toContain('não consiga remover a proteção');
    expect(wrapper.get('.actions .btn').attributes('disabled')).toBeDefined();

    request.mockResolvedValueOnce(undefined).mockResolvedValueOnce(status());
    await wrapper.get('#disableCode').setValue('123456');
    await wrapper.get('.actions .btn').trigger('click');
    await flushPromises();

    expect(request).toHaveBeenCalledWith('/auth/second-factor', {
      method: 'DELETE',
      body: { code: '123456' },
    });
  });

  it('não oferece desligar quando o escritório exige', async () => {
    request.mockResolvedValue(
      status({ active: true, requiredByOrganization: true, unusedRecoveryCodes: 10 }),
    );

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('escritório exige o segundo fator');
    expect(wrapper.find('.actions .btn--ghost').exists()).toBe(false);
  });

  it('avisa quando restam poucos códigos de recuperação', async () => {
    request.mockResolvedValue(status({ active: true, unusedRecoveryCodes: 2 }));

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.get('.warn').text()).toContain('Restam poucos códigos');
  });

  it('desenha o QR do endereço, com rótulo para quem não o enxerga', async () => {
    request.mockResolvedValueOnce(status());
    const wrapper = mountView();
    await flushPromises();

    request.mockResolvedValueOnce({
      secret: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
      uri: 'otpauth://totp/LEX%20OS:ana@escritorio.invalid?secret=ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
    });
    await wrapper.get('.actions .btn').trigger('click');
    await flushPromises();

    const qr = wrapper.get('svg.qr');
    expect(qr.attributes('role')).toBe('img');
    expect(qr.attributes('aria-label')).toContain('aplicativo autenticador');
    // Sem caminho não há código: um SVG vazio passaria despercebido na revisão visual.
    expect((qr.get('path').attributes('d') ?? '').length).toBeGreaterThan(100);
    // A chave continua à vista para quem não consegue escanear.
    expect(wrapper.get('.secret').text()).toContain('ABCD EFGH');
  });

  it('mostra a recusa do servidor e limpa o código digitado', async () => {
    request.mockResolvedValueOnce(status());
    const wrapper = mountView();
    await flushPromises();

    request.mockResolvedValueOnce({ secret: 'ABCDEFGH', uri: 'otpauth://x' });
    await wrapper.get('.actions .btn').trigger('click');
    await flushPromises();

    request.mockRejectedValueOnce(
      new ApiError({
        statusCode: 401,
        code: 'SECOND_FACTOR_CODE_INVALID',
        message: 'Código inválido. Confira o aplicativo e tente de novo.',
      }),
    );
    await wrapper.get('#code').setValue('000000');
    await wrapper.get('.actions .btn').trigger('click');
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain('Código inválido');
    expect((wrapper.get('#code').element as HTMLInputElement).value).toBe('');
  });
});
