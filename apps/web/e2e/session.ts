import { expect, type Page } from '@playwright/test';

export const organizationSlug = 'lex-os-demonstracao';
export const adminEmail = 'admin@lexos.invalid';

export async function login(page: Page): Promise<void> {
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (password === undefined || password === '') {
    throw new Error('SEED_ADMIN_PASSWORD is required for the local end-to-end flow.');
  }

  await page.goto('/entrar');
  await page.getByLabel('Escritório').fill(organizationSlug);
  await page.getByLabel('E-mail').fill(adminEmail);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  // A lista de casos ganhou caminho próprio quando o realce da navegação foi consertado —
  // a raiz agora redireciona, e o pós-login aterrissa em /casos.
  await expect(page).toHaveURL(/\/casos$/u);
  await expect(page.getByRole('heading', { name: 'Casos' })).toBeVisible();
}
