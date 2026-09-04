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

/**
 * O caso da apresentação.
 *
 * Era o RT-2026-0007 até 2026-09-03. Ele carrega treze eventos produzidos pelo extrator que
 * inventava sempre o mesmo, e extração é append-only por decisão: não há como removê-los, e não
 * deveria haver. O RT-2026-0008 tem os mesmos cinco documentos, preparados pelo pipeline que lê
 * o arquivo, e por isso é o que se mostra.
 */
const CASO = 'RT-2026-0008';

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
    /**
     * O 401 da restauração de sessão é o caminho correto, não um defeito.
     *
     * A aplicação tenta reconstruir a sessão a partir de um cookie que o JavaScript não pode
     * ler, então a única forma de descobrir que não há sessão é pedir e receber 401 — e o
     * navegador registra isso no console, sem que a página possa evitar. Enquanto a vistoria
     * contava os dois como problema, ela relatava dois falsos a cada execução; um relatório
     * que sempre acusa algo conhecido ensina a ignorar o relatório inteiro, que é o oposto do
     * que ele existe para fazer.
     */
    const esperado = (texto: string): boolean =>
      texto.includes('/auth/refresh') ||
      (texto.includes('Failed to load resource') && texto.includes('401'));

    page.on('console', (msg) => {
      if (msg.type() === 'error' && !esperado(msg.text())) {
        problemas.push(`console: ${msg.text().slice(0, 160)}`);
      }
    });
    page.on('response', (res) => {
      const rota = res.url().split('/api/v1')[1] ?? '';
      if (res.status() >= 400 && res.url().includes('/api/v1/') && !esperado(rota)) {
        problemas.push(`HTTP ${res.status()} ${rota}`);
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

    // O pós-login aterrissa em /casos desde que o realce da navegação foi consertado, então
    // fotografar aqui produzia a lista de casos com o nome de painel — e o painel, que é a
    // primeira tela que o escritório vê de verdade, nunca aparecia na vistoria.
    await page.getByRole('link', { name: 'Painel' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
    await foto('02-painel');

    // Pela barra de navegação, e não por nome: o painel tem um atalho "Ver casos" que também
    // leva a /casos, e o seletor por papel encontrava os dois.
    await page.getByRole('link', { name: 'Casos', exact: true }).click();
    await expect(page.getByText(CASO)).toBeVisible({ timeout: 20_000 });
    await foto('03-lista-de-casos');

    await page
      .getByRole('link', { name: /0010101-16/u })
      .first()
      .click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
    await foto('04-caso');

    // O documento com o cartão de ponto é o que carrega a divergência da demonstração.
    const documento = page.getByText('Cartão de ponto — março/2026').first();
    if (await documento.isVisible({ timeout: 15_000 }).catch(() => false)) {
      await documento.click();
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
      await foto('05-documento');
      await page.goBack();
    } else {
      // Pular calado é o que fez a vistoria vir "sem problemas" sem ter olhado as abas.
      problemas.push('documento "Cartão de ponto — março/2026" não apareceu no caso');
    }

    // As três telas que mostram o trabalho da máquina — é por elas que um escritório julga o
    // produto. A versão anterior sondava com `isVisible()` logo depois do `goBack()`, sem dar
    // tempo de a página assentar, e seguia adiante calada quando o link ainda não existia: a
    // vistoria vinha "sem problemas" justamente por não ter olhado. Agora espera, volta ao caso
    // entre uma aba e outra — clicar navega para fora —, e reclama alto se alguma faltar.
    const urlDoCaso = page.url();
    for (const [aba, nome] of [
      ['Cronologia', '06-cronologia'],
      ['Checklist', '07-checklist'],
      ['Tarefas', '08-tarefas'],
    ] as const) {
      await page.goto(urlDoCaso);
      const link = page.getByRole('link', { name: aba }).first();
      try {
        await link.waitFor({ state: 'visible', timeout: 15_000 });
      } catch {
        problemas.push(`aba "${aba}" não apareceu na tela do caso`);
        continue;
      }
      await link.click();
      await foto(nome);
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
