import { expect, test } from '@playwright/test';

import { organizationSlug } from './session.js';

/**
 * Vistoria visual antes de uma apresentação.
 *
 * Não é teste de regressão: é a jornada que o dono vai percorrer na frente de um escritório,
 * fotografada tela a tela. O que ele pediu foi "procurar o que está feio antes do cliente ver",
 * e para isso é preciso olhar, não só conferir que a rota devolve 200.
 *
 * Roda contra a instalação implantada, e por isso não semeia nem apaga nada — ele lê o caso que
 * já existe. Rode assim:
 *
 *   VISTORIA=1 E2E_BASE_URL=https://lex-os-web-theta.vercel.app SEED_ADMIN_PASSWORD=… \
 *     pnpm exec playwright test e2e/vistoria.spec.ts
 */

const CASO = 'RT-2026-0007';

test.describe('vistoria da jornada de apresentação', () => {
  test.describe.configure({ mode: 'serial' });

  // A esteira sobe um banco recém-semeado, onde o caso curado do demo não existe — a vistoria
  // lá só produziria vermelho sem informação. Ela é ferramenta de véspera de apresentação,
  // ligada de propósito, nunca por arrasto.
  test.skip(
    process.env.VISTORIA !== '1',
    'Vistoria fotográfica roda contra o demo implantado — ligue com VISTORIA=1.',
  );

  test('percorre e fotografa a jornada inteira', async ({ page }) => {
    test.setTimeout(180_000);
    const senha = process.env.SEED_ADMIN_PASSWORD;
    expect(senha, 'SEED_ADMIN_PASSWORD precisa estar no ambiente').toBeTruthy();

    const problemas: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        problemas.push(`console: ${msg.text().slice(0, 160)}`);
      }
    });
    page.on('response', (res) => {
      if (res.status() >= 400 && res.url().includes('/api/v1/')) {
        problemas.push(`HTTP ${res.status()} ${res.url().split('/api/v1')[1]}`);
      }
    });

    const pasta = test.info().project.name;
    const foto = async (nome: string) => {
      await page.waitForLoadState('networkidle');
      // O esqueleto de carregamento fica em aria-busy: fotografar antes de ele sumir
      // renderia a vistoria cega para a tela de verdade.
      await page
        .locator('[aria-busy="true"]')
        .first()
        .waitFor({ state: 'hidden', timeout: 15_000 })
        .catch(() => {});
      await page.screenshot({ path: `vistoria/${pasta}/${nome}.png`, fullPage: true });
    };

    await page.goto('/');
    await page.getByLabel('Escritório').fill(organizationSlug);
    await page.getByLabel('E-mail').fill('admin@lexos.invalid');
    await page.getByLabel('Senha').fill(senha as string);
    await foto('01-entrada');
    await page.getByRole('button', { name: /entrar/iu }).click();

    await expect(page.getByRole('link', { name: 'Casos' })).toBeVisible({ timeout: 30_000 });
    await foto('02-painel');

    await page.getByRole('link', { name: 'Casos' }).click();
    await expect(page.getByText(CASO)).toBeVisible({ timeout: 20_000 });
    await foto('03-lista-de-casos');

    await page
      .getByRole('link', { name: /0009999-84/u })
      .first()
      .click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
    await foto('04-caso');

    // O documento com o cartão de ponto é o que carrega a divergência da demonstração.
    const documento = page.getByText('Cartão de ponto — março/2026').first();
    if (await documento.isVisible().catch(() => false)) {
      await documento.click();
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
      await foto('05-documento');
      await page.goBack();
    }

    for (const [aba, nome] of [
      ['Cronologia', '06-cronologia'],
      ['Checklist', '07-checklist'],
      ['Tarefas', '08-tarefas'],
    ] as const) {
      const link = page.getByRole('link', { name: aba }).first();
      if (await link.isVisible().catch(() => false)) {
        await link.click();
        await foto(nome);
      }
    }

    for (const [secao, nome] of [
      ['Agenda', '09-agenda'],
      ['Busca', '10-busca'],
      ['Custos', '11-custos'],
      ['Pessoas', '12-pessoas'],
      ['Equipe', '13-equipe'],
      ['Auditoria', '14-auditoria'],
    ] as const) {
      const link = page.getByRole('link', { name: secao }).first();
      if (await link.isVisible().catch(() => false)) {
        await link.click();
        await foto(nome);
      } else {
        problemas.push(`seção "${secao}" não apareceu na navegação`);
      }
    }

    // O relatório sai no console do Playwright, que é onde quem roda a vistoria está olhando.
    console.log(`\n=== vistoria: ${problemas.length} problema(s)`);
    for (const p of [...new Set(problemas)]) {
      console.log(`  · ${p}`);
    }
  });
});
