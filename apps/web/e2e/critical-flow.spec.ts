import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const organizationId = '00000000-0000-4000-8000-000000000001';
const email = 'admin@lexos.invalid';

async function login(page: Page): Promise<void> {
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (password === undefined || password === '') {
    throw new Error('SEED_ADMIN_PASSWORD is required for the local end-to-end flow.');
  }

  await page.goto('/entrar');
  await page.getByLabel('Organização').fill(organizationId);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/$/u);
  await expect(page.getByRole('heading', { name: 'Casos' })).toBeVisible();
}

test('login, painel e navegação do caso respondem sem erro', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('response', (response) => {
    const expectedSessionProbe =
      response.status() === 401 && response.url().endsWith('/api/v1/auth/refresh');
    if (response.status() >= 400 && !expectedSessionProbe) {
      consoleErrors.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });

  await login(page);
  await page.getByRole('link', { name: 'Painel' }).click();
  await expect(page.getByRole('heading', { name: 'Painel' })).toBeVisible();
  await expect(page.getByText('Casos em aberto')).toBeVisible();

  await page.getByRole('link', { name: 'Casos', exact: true }).click();
  await page.getByRole('link', { name: 'DEMO-0001' }).click();
  await expect(page.getByRole('heading', { name: /Caso.*fictício.*demonstração/iu })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cronologia' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Checklist' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Tarefas' })).toBeVisible();

  await page.getByRole('link', { name: 'Editar caso' }).click();
  await expect(page.getByRole('heading', { name: 'Editar caso' })).toBeVisible();
  await expect(page.getByLabel('Código interno')).toHaveValue('DEMO-0001');
  await page.getByRole('link', { name: 'Cancelar' }).click();
  await expect(page.getByRole('heading', { name: /Caso.*fictício.*demonstração/iu })).toBeVisible();

  expect(consoleErrors).toEqual([]);
});

test('ordem de teclado alcança o fluxo e a página não estoura a largura', async ({ page }) => {
  await login(page);
  await page.keyboard.press('Tab');
  const focused = page.locator(':focus');
  await expect(focused).toBeVisible();
  await expect(focused).not.toHaveCSS('outline-style', 'none');

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);

  await page.getByRole('link', { name: 'Busca' }).click();
  await expect(page.getByRole('heading', { name: 'Busca no acervo' })).toBeVisible();
  await expect(page.getByLabel('Caso')).toBeVisible();
});

test('organização fictícia percorre caso, upload, worker, extração, cronologia, confirmação e auditoria', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('response', (response) => {
    const expectedSessionProbe =
      response.status() === 401 && response.url().endsWith('/api/v1/auth/refresh');
    if (response.status() >= 400 && !expectedSessionProbe) {
      consoleErrors.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });

  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const internalCode = `E2E-${suffix}`;
  const caseTitle = `Caso fictício de verificação ${suffix}`;
  const filename = `contrato-ficticio-${suffix.toLowerCase()}.txt`;
  const documentTitle = filename.replace(/\.txt$/u, '');

  await login(page);
  await page.getByRole('link', { name: 'Abrir caso' }).click();
  await expect(page.getByRole('heading', { name: 'Abrir novo caso' })).toBeVisible();
  await page.getByLabel('Código interno').fill(internalCode);
  await page.getByLabel('Título').fill(caseTitle);
  await page.getByLabel('Área jurídica').fill('Trabalhista');
  await page.getByLabel('Tipo de caso').fill('Reclamação trabalhista');
  await page.getByLabel('Responsável').selectOption({ label: 'Administrador Fictício' });
  await page
    .getByLabel('Descrição')
    .fill('Fixture automatizada sem dados pessoais ou jurídicos reais.');
  await page.getByRole('button', { name: 'Abrir caso' }).click();
  await expect(page.getByRole('heading', { name: caseTitle })).toBeVisible();
  await expect(page.getByText(internalCode, { exact: true })).toBeVisible();

  await page.getByLabel('Selecionar arquivos para envio').setInputFiles({
    name: filename,
    mimeType: 'text/plain',
    buffer: Buffer.from(
      `Contrato fictício LEX-2026-0001, celebrado em 05/08/2026. Conteúdo exclusivo para teste ponta a ponta ${suffix}.`,
      'utf8',
    ),
  });
  await page.getByRole('button', { name: 'Enviar 1 arquivo' }).click();
  await expect(page.getByText('1', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(filename, { exact: true })).toBeVisible();

  const documentRow = page.getByRole('row').filter({ hasText: filename });
  await expect(documentRow.getByText('Aguardando revisão')).toBeVisible({ timeout: 90_000 });
  await documentRow.getByRole('link').click();
  await expect(page.getByRole('heading', { name: documentTitle })).toBeVisible();
  await expect(page.getByText('Dados identificados')).toBeVisible();
  await expect(page.getByText('LEX-2026-0001', { exact: true })).toBeVisible();
  await expect(page.getByText('Texto extraído')).toBeVisible();
  await expect(page.getByText('Histórico de preparação')).toBeVisible();

  await page.getByRole('link', { name: 'caso', exact: true }).click();
  await page.getByRole('link', { name: 'Cronologia' }).click();
  await expect(page.getByRole('heading', { name: 'Cronologia' })).toBeVisible();
  const event = page.getByRole('listitem').filter({ hasText: 'Celebração do contrato fictício' });
  await expect(event.getByText('Aguardando revisão')).toBeVisible();
  await event.getByRole('button', { name: 'Confirmar' }).click();
  await expect(event.getByText('Confirmado')).toBeVisible();

  await page.getByRole('link', { name: 'Auditoria' }).click();
  await expect(page.getByRole('heading', { name: 'Auditoria' })).toBeVisible();
  await page.getByLabel('Ação exata').fill('timeline.event.confirmed');
  await page.getByLabel('Tipo de entidade').fill('timeline_event');
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(page.getByRole('cell', { name: 'timeline.event.confirmed' }).first()).toBeVisible();

  expect(consoleErrors).toEqual([]);
});
