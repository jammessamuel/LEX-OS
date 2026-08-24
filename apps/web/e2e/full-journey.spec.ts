import { expect, test } from '@playwright/test';

import { login } from './session';

/**
 * A jornada obrigatória da Entrega 11: caso → envio → worker → extração → cronologia →
 * confirmação humana → auditoria. Tudo com dados fictícios; o provedor mock ignora o
 * conteúdo enviado e devolve texto determinístico com uma data, o que garante ao menos
 * um evento de cronologia aguardando confirmação.
 */
test('jornada completa termina com cronologia confirmada e trilha de auditoria', async ({
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  await login(page);

  // Caso novo por execução: a jornada não pode depender do estado do caso demo.
  // O marcador do projeto impede desktop e mobile, iniciados no mesmo milissegundo, de
  // disputarem a chave única do código interno no banco compartilhado da suíte.
  const projectMarker = testInfo.project.name.startsWith('mobile') ? 'M' : 'D';
  const internalCode = `E2E-${projectMarker}-${Date.now().toString(36).toUpperCase()}`;
  await page.getByRole('link', { name: 'Abrir caso' }).click();
  await page.getByLabel('Código interno').fill(internalCode);
  await page.getByLabel('Título').fill('Jornada fictícia de verificação ponta a ponta');
  await page.getByLabel('Área jurídica').fill('Direito trabalhista');
  await page.getByLabel('Tipo de caso').fill('Reclamação trabalhista');
  // Teto acima de zero: com o padrão 0,00 o worker interrompe o preparo antes do provedor.
  await page.getByLabel('Teto de preparo (R$)').fill('10.00');
  await page.getByRole('button', { name: 'Abrir caso' }).click();
  await expect(
    page.getByRole('heading', { name: 'Jornada fictícia de verificação ponta a ponta' }),
  ).toBeVisible();

  await page.getByLabel('Selecionar arquivos para envio').setInputFiles({
    name: 'contrato-ficticio.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(
      'Contrato ficticio da jornada de verificacao ponta a ponta. Sem dados reais.',
      'utf-8',
    ),
  });
  await page.getByRole('button', { name: /^Enviar 1 arquivo/u }).click();
  await expect(page.getByText(/Os aceitos entraram na fila de preparação/u)).toBeVisible();

  // O pipeline tem sete etapas; a cronologia só existe quando o worker termina.
  await page.getByRole('link', { name: 'Cronologia' }).click();
  await expect(async () => {
    await page.reload();
    await expect(page.getByRole('button', { name: 'Confirmar', exact: true }).first()).toBeVisible({
      timeout: 3_000,
    });
  }).toPass({ timeout: 180_000, intervals: [4_000] });

  // Confirmação humana: o evento troca pela resposta do servidor e o botão desaparece.
  const confirmButtons = page.getByRole('button', { name: 'Confirmar', exact: true });
  const pendingBefore = await confirmButtons.count();
  await confirmButtons.first().click();
  await expect(confirmButtons).toHaveCount(pendingBefore - 1);

  // Procedência do documento preparado: a promessa central verificada depois de o worker
  // ter rodado de verdade, e não sobre resposta simulada. O evento acima já prova que o
  // pipeline terminou, então aqui não é preciso esperar de novo.
  await page.getByRole('link', { name: internalCode }).click();
  await page.locator('a[href^="/documentos/"]').first().click();
  await expect(page.getByText('Texto extraído')).toBeVisible();
  await expect(page.getByText('Dados identificados')).toBeVisible();
  await expect(page.getByText('Histórico de preparação')).toBeVisible();

  // A jornada termina na supervisão: a trilha registra as ações sem expor conteúdo jurídico.
  await page.getByRole('link', { name: 'Auditoria' }).click();
  await expect(page.getByRole('heading', { name: 'Auditoria' })).toBeVisible();
  await expect(page.locator('table tbody tr').first()).toBeVisible();

  // Filtrar pela ação exata prova que a confirmação humana virou registro, e não que
  // existe alguma linha qualquer na tabela.
  await page.getByLabel('Ação exata').fill('timeline.event.confirmed');
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(page.getByRole('cell', { name: 'timeline.event.confirmed' }).first()).toBeVisible();
});
