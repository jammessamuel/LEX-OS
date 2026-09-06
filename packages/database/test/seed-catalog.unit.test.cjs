const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');

/**
 * O seed é dado, e dado quebrado só aparece quando alguém roda o seed.
 *
 * Em 2026-09-06 quatro faixas novas da biblioteca de prompts trouxeram tipos documentais, e nove
 * códigos já existiam no catálogo sob outra categoria — certidões, testamento, formal de partilha,
 * contrato social, nota fiscal e duplicata. Os testes de unidade passaram, as duas suítes de
 * integração passaram, e o CI reprovou: ele reexecuta `pnpm db:seed` e o código é único.
 *
 * O defeito de fundo não era a duplicata. Era que nada a encontrava sem subir um banco. Ler o
 * arquivo e conferir a lista custa milissegundos e fecha essa janela — inclusive para permissões,
 * cuja identidade deriva da posição no array e onde uma duplicata seria pior ainda.
 */

const seedPath = path.join(__dirname, '..', 'prisma', 'seed.ts');
const seed = readFileSync(seedPath, 'utf8');

/** Lê um array de tuplas do seed sem executá-lo: importar exigiria banco e credenciais. */
function tuplasDe(nomeDaConstante) {
  const inicio = seed.indexOf(`const ${nomeDaConstante} = [`);
  assert.notEqual(inicio, -1, `A constante ${nomeDaConstante} sumiu do seed.`);
  const fim = seed.indexOf('] as const;', inicio);
  assert.notEqual(fim, -1, `A constante ${nomeDaConstante} não termina com "] as const;".`);
  const bloco = seed.slice(inicio, fim);
  // A primeira posição de cada tupla é o código; o resto é rótulo e categoria, com acento e
  // vírgula, e não interessa aqui.
  return [...bloco.matchAll(/\[\s*'([^']+)'/gu)].map((match) => match[1]);
}

function duplicados(valores) {
  const contagem = new Map();
  for (const valor of valores) {
    contagem.set(valor, (contagem.get(valor) ?? 0) + 1);
  }
  return [...contagem].filter(([, quantas]) => quantas > 1).map(([valor]) => valor);
}

describe('catálogo semeado', () => {
  it('não repete código de tipo documental', () => {
    const codigos = tuplasDe('documentTypes');
    assert.ok(codigos.length > 50, 'O catálogo encolheu de forma suspeita.');
    assert.deepEqual(
      duplicados(codigos),
      [],
      'Código repetido no catálogo: o seed falha na restrição de unicidade e derruba o CI.',
    );
  });

  it('não repete código de permissão', () => {
    // Aqui a duplicata é pior que um erro de seed: o identificador da permissão deriva da posição
    // no array, e um código repetido produziria duas permissões com o mesmo nome e efeitos
    // diferentes conforme qual delas o papel recebeu.
    const codigos = tuplasDe('permissions');
    assert.ok(codigos.length > 10, 'A lista de permissões encolheu de forma suspeita.');
    assert.deepEqual(duplicados(codigos), [], 'Código de permissão repetido no seed.');
  });

  it('escreve todo código em maiúsculas, sem acento e sem espaço', () => {
    // O código viaja em prompt, em exemplo de contrato e em item de checklist. Uma variação de
    // grafia não quebra nada no dia em que entra: quebra no dia em que alguém compara duas
    // strings, que é o que a classificação e o casamento de checklist fazem.
    for (const codigo of tuplasDe('documentTypes')) {
      assert.match(
        codigo,
        /^[A-Z0-9_]+$/u,
        `O código ${codigo} foge do formato que o resto do produto compara.`,
      );
    }
  });
});
