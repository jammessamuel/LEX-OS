import { expect, type Page } from '@playwright/test';

export const organizationId = '00000000-0000-4000-8000-000000000001';
export const adminEmail = 'admin@lexos.invalid';

export async function login(page: Page): Promise<void> {
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (password === undefined || password === '') {
    throw new Error('SEED_ADMIN_PASSWORD is required for the local end-to-end flow.');
  }

  await page.goto('/entrar');
  await page.getByLabel('Organização').fill(organizationId);
  await page.getByLabel('E-mail').fill(adminEmail);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/$/u);
  await expect(page.getByRole('heading', { name: 'Casos' })).toBeVisible();
}
