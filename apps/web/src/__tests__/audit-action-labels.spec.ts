import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { auditActionLabel } from '../domain/vocabulary.js';

/**
 * Toda ação que o servidor grava na auditoria tem nome em português na tela.
 *
 * A trilha de auditoria é a tela que um escritório abre para provar controle — a um cliente, a
 * um sócio, a quem audita. Ela listava `case.confidential.read` e `auth.refresh.succeeded`:
 * identificador técnico, em inglês, sobre a operação de um escritório brasileiro.
 *
 * Traduzir uma vez não resolve: a ação seguinte nasce no servidor, e ninguém lembra de vir aqui.
 * Este teste lê os códigos direto do código que os grava, então quem criar uma ação nova sem
 * rótulo descobre no teste, e não com o cliente na frente da tela.
 *
 * Lê a fonte da API e do worker em vez de importar deles: a interface não depende do servidor, e
 * criar essa dependência para um teste seria pior que a leitura de texto. Mesmo padrão da deriva
 * entre prompt e catálogo, que lê o seed.
 */

const RAIZ = path.resolve(__dirname, '../../../..');
const FONTES = [path.join(RAIZ, 'apps/api/src'), path.join(RAIZ, 'apps/worker/src')];
const ACAO = /action:\s*'([a-z_]+(?:\.[a-z_]+)+)'/gu;

function arquivosDe(diretorio: string): string[] {
  return readdirSync(diretorio).flatMap((entrada) => {
    const completo = path.join(diretorio, entrada);
    if (statSync(completo).isDirectory()) {
      return arquivosDe(completo);
    }
    return completo.endsWith('.ts') ? [completo] : [];
  });
}

function acoesGravadas(): string[] {
  const encontradas = new Set<string>();
  for (const raiz of FONTES) {
    for (const arquivo of arquivosDe(raiz)) {
      for (const achado of readFileSync(arquivo, 'utf8').matchAll(ACAO)) {
        if (achado[1] !== undefined) {
          encontradas.add(achado[1]);
        }
      }
    }
  }
  return [...encontradas].sort();
}

describe('rótulos da trilha de auditoria', () => {
  const acoes = acoesGravadas();

  it('encontra as ações no código que as grava', () => {
    // Se a extração quebrar, o teste abaixo passaria por não ter o que conferir. Silêncio aqui
    // reabriria exatamente o defeito que ele fecha.
    expect(acoes.length).toBeGreaterThan(40);
    expect(acoes).toContain('case.confidential.read');
  });

  it('dá nome em português a cada ação gravada', () => {
    const semRotulo = acoes.filter((acao) => auditActionLabel(acao) === acao);
    expect(semRotulo).toEqual([]);
  });

  it('não deixa identificador técnico passar por rótulo', () => {
    for (const acao of acoes) {
      const rotulo = auditActionLabel(acao);
      expect(rotulo).not.toMatch(/\.|_/u);
      expect(rotulo[0]).toBe(rotulo[0]?.toUpperCase());
    }
  });
});
