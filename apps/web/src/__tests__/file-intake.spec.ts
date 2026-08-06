import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import FileIntakePanel from '../components/FileIntakePanel.vue';

const upload = vi.hoisted(() => vi.fn());

vi.mock('../api/client.js', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return { ...actual, upload };
});

const { ApiError } = await import('../api/client');

function makeFile(name: string, size: number, type = 'application/pdf'): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

async function pick(wrapper: ReturnType<typeof mount>, files: File[]): Promise<void> {
  const input = wrapper.get('input[type="file"]');
  Object.defineProperty(input.element, 'files', { value: files, configurable: true });
  await input.trigger('change');
}

describe('FileIntakePanel', () => {
  beforeEach(() => {
    upload.mockReset();
  });

  it('barra localmente arquivo grande demais, com o motivo e sem chamar a API', async () => {
    const wrapper = mount(FileIntakePanel, { props: { caseId: 'caso-1' } });

    await pick(wrapper, [
      makeFile('peticao.pdf', 1024),
      makeFile('scan-gigante.pdf', 30 * 1024 * 1024),
    ]);

    const text = wrapper.text();
    expect(text).toContain('peticao.pdf');
    expect(text).toContain('scan-gigante.pdf');
    expect(text).toContain('Excede 25 MB');
    expect(upload).not.toHaveBeenCalled();
  });

  it('apresenta o resultado parcial com aceitos, recusados e quarentena', async () => {
    upload.mockResolvedValue({
      accepted: [
        {
          file: { id: 'f1', status: 'AVAILABLE', filename: 'peticao.pdf' },
          job: { id: 'j1', jobType: 'FILE_VALIDATION', status: 'QUEUED' },
        },
        {
          file: { id: 'f2', status: 'QUARANTINED', filename: 'anexo.pdf' },
          job: { id: 'j2', jobType: 'VIRUS_SCAN', status: 'QUEUED' },
        },
      ],
      rejected: [
        {
          fileIndex: 2,
          code: 'FILE_MIME_MISMATCH',
          message: 'O conteúdo não corresponde ao tipo.',
        },
      ],
    });

    const wrapper = mount(FileIntakePanel, { props: { caseId: 'caso-1' } });
    await pick(wrapper, [
      makeFile('peticao.pdf', 1024),
      makeFile('anexo.pdf', 1024),
      makeFile('duvidoso.pdf', 1024),
    ]);

    await wrapper.get('.actions .btn').trigger('click');
    await flushPromises();

    const status = wrapper.get('[role="status"]').text();
    expect(status).toContain('2');
    expect(status).toContain('aceitos');
    expect(status).toContain('1');

    // A recusa do servidor aparece com o nome do arquivo, resolvido pelo índice.
    expect(wrapper.text()).toContain('duvidoso.pdf');
    expect(wrapper.text()).toContain('O conteúdo não corresponde ao tipo.');

    expect(wrapper.emitted('finished')).toHaveLength(1);
    expect(upload).toHaveBeenCalledWith('/cases/caso-1/files/upload', expect.any(Array));
  });

  it('mostra a falha do envio inteiro com referência e permite tentar de novo', async () => {
    upload.mockRejectedValueOnce(
      new ApiError({
        statusCode: 503,
        code: 'FILE_STORAGE_UNAVAILABLE',
        message: 'O armazenamento está temporariamente indisponível.',
        requestId: 'req-9',
      }),
    );

    const wrapper = mount(FileIntakePanel, { props: { caseId: 'caso-1' } });
    await pick(wrapper, [makeFile('peticao.pdf', 1024)]);
    await wrapper.get('.actions .btn').trigger('click');
    await flushPromises();

    const alert = wrapper.get('[role="alert"]').text();
    expect(alert).toContain('temporariamente indisponível');
    expect(alert).toContain('req-9');
    expect(wrapper.emitted('finished')).toBeUndefined();

    // A fila sobrevive à falha: ninguém re-seleciona dez arquivos por causa de um 503.
    expect(wrapper.text()).toContain('peticao.pdf');
  });
});
