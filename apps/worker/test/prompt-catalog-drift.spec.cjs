const { readFileSync } = require('node:fs');
const path = require('node:path');

let prompts;

beforeAll(async () => {
  prompts = await import('@lex-os/ai-prompts');
});

/**
 * Todo código de tipo documental citado num prompt existe no catálogo semeado.
 *
 * Este defeito já aconteceu duas vezes. Na primeira, o exemplo do prompt de classificação usava
 * `MATRICULA` antes de `MATRICULA` existir no catálogo — está registrado como P0.3 em
 * `docs/product/pendencias-biblioteca-de-prompts.md`. Na segunda, em 2026-09-03, as faixas
 * tributária e previdenciária nasceram citando `AUTO_DE_INFRACAO`, `CERTIDAO_DIVIDA_ATIVA`,
 * `CNIS` e `PPP`, nenhum deles semeado.
 *
 * A consequência é silenciosa, que é o que a torna cara: o prompt manda respeitar o catálogo, o
 * catálogo não tem o código, e todo auto de infração cai em OUTRO. Nada falha, nada avisa, e a
 * área inteira parece implantada sem classificar um documento sequer.
 *
 * O catálogo é lido do texto do seed em vez de importado porque o módulo executa a semeadura ao
 * ser carregado. A leitura falha alto se o formato mudar — silêncio aqui reabriria o defeito que
 * o teste existe para fechar.
 */

function seededDocumentTypeCodes() {
  const seedPath = path.resolve(__dirname, '../../../packages/database/prisma/seed.ts');
  const source = readFileSync(seedPath, 'utf8');
  const start = source.indexOf('const documentTypes = [');
  if (start === -1) {
    throw new Error('O catálogo de tipos documentais mudou de forma: `const documentTypes = [`.');
  }
  const end = source.indexOf('] as const;', start);
  if (end === -1) {
    throw new Error('O catálogo de tipos documentais não termina em `] as const;`.');
  }
  const codes = [...source.slice(start, end).matchAll(/\[\s*'([A-Z0-9_]+)'/gu)].map((m) => m[1]);
  if (codes.length < 60) {
    throw new Error(`Só ${codes.length} códigos lidos do seed — a extração quebrou.`);
  }
  return new Set(codes);
}

/** Todo valor de string sob uma chave que nomeia tipo documental, em qualquer profundidade. */
function documentTypeCodesIn(value, chave = '') {
  if (typeof value === 'string') {
    return /^(item)?documentTypeCode$|^availableTypeCodes$|^code$/iu.test(chave) ? [value] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => documentTypeCodesIn(item, chave));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => documentTypeCodesIn(v, k));
  }
  return [];
}

describe('divergência prompt × catálogo de tipos documentais', () => {
  it('todo código citado num exemplo de prompt existe no catálogo semeado', () => {
    const semeados = seededDocumentTypeCodes();
    const faltando = [];
    for (const prompt of prompts.promptLibrary) {
      for (const codigo of documentTypeCodesIn(prompt.examples)) {
        if (!semeados.has(codigo)) {
          faltando.push(`${prompt.identifier}: ${codigo}`);
        }
      }
    }
    expect(faltando).toEqual([]);
  });

  it('as faixas novas têm tipo documental próprio, e não só o balde OUTRO', () => {
    // Faixa cujo acervo inteiro cai em OUTRO está catalogada mas não implantada: a
    // classificação nunca acerta e nenhum item de checklist dela fecha. Esta asserção é o que
    // impede uma especialidade de entrar pela metade outra vez.
    const semeados = seededDocumentTypeCodes();
    for (const codigo of [
      'AUTO_INFRACAO_TRIBUTARIO',
      'CERTIDAO_DIVIDA_ATIVA',
      'NOTIFICACAO_LANCAMENTO',
      'CNIS',
      'PPP',
      'CARTA_CONCESSAO',
      'CTC',
    ]) {
      expect(semeados.has(codigo)).toBe(true);
    }
  });
});
