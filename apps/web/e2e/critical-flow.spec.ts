import { expect, test, type Page } from '@playwright/test';

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
