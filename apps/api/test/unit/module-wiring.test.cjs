const assert = require('node:assert/strict');
const { readdirSync, readFileSync, statSync } = require('node:fs');
const { join, dirname, basename } = require('node:path');
const { describe, it } = require('node:test');

/**
 * Guarda de fiação de módulo.
 *
 * O defeito que originou este teste: `TaskNotificationsService` passou a injetar
 * `RUNTIME_CONFIG` e o `TasksModule` não importava `RuntimeConfigModule`. TypeScript não
 * reclama — a resolução do Nest acontece na inicialização —, então a compilação passou, os
 * testes de unidade passaram, e a API só falhou ao subir na esteira, travando o job de
 * integração por vinte minutos antes de alguém entender o motivo.
 *
 * Verificar isso sem levantar o Nest é possível e barato: quem injeta um token precisa estar
 * num módulo que o forneça, e a convenção deste repositório é um módulo por pasta.
 */

const raiz = join(__dirname, '..', '..', 'src');

/** Todo arquivo .ts sob src, sem entrar em pasta gerada. */
function arquivos(diretorio) {
  const encontrados = [];
  for (const entrada of readdirSync(diretorio)) {
    const caminho = join(diretorio, entrada);
    if (statSync(caminho).isDirectory()) {
      encontrados.push(...arquivos(caminho));
    } else if (entrada.endsWith('.ts')) {
      encontrados.push(caminho);
    }
  }
  return encontrados;
}

/**
 * Tokens injetados por `@Inject(TOKEN)` e o módulo que os fornece.
 *
 * Só tokens de módulo: os que vêm por classe o TypeScript já resolve, e os que vêm de módulo
 * global não precisam de import. Acrescente aqui quando criar um token novo de módulo.
 */
const TOKENS = [['RUNTIME_CONFIG', 'RuntimeConfigModule']];

describe('fiação dos módulos', () => {
  it('quem injeta um token de módulo está num módulo que o importa', () => {
    const pendencias = [];
    for (const arquivo of arquivos(raiz)) {
      if (arquivo.endsWith('.module.ts')) {
        continue;
      }
      const fonte = readFileSync(arquivo, 'utf8');
      for (const [token, modulo] of TOKENS) {
        if (!fonte.includes(`@Inject(${token})`)) {
          continue;
        }
        const pasta = dirname(arquivo);
        const modulos = readdirSync(pasta).filter((nome) => nome.endsWith('.module.ts'));
        assert.ok(
          modulos.length > 0,
          `${basename(arquivo)} injeta ${token} e não há módulo na pasta para conferir.`,
        );
        // Tem de estar dentro de `imports: [...]`, e não só mencionado no arquivo: a linha
        // `import { RuntimeConfigModule }` sobrevive à remoção do módulo do array, e conferir
        // só a menção deixaria exatamente o defeito que este teste existe para pegar.
        const declarado = modulos.some((nome) => {
          const fonteModulo = readFileSync(join(pasta, nome), 'utf8');
          const lista = /imports:\s*\[([\s\S]*?)\]/u.exec(fonteModulo);
          return lista !== null && lista[1].includes(modulo);
        });
        if (!declarado) {
          pendencias.push(`${basename(arquivo)} injeta ${token} sem ${modulo} em ${modulos[0]}`);
        }
      }
    }
    assert.deepEqual(pendencias, []);
  });

  it('encontra pelo menos um injetor, senão o teste passaria por não olhar nada', () => {
    // Guarda contra o próprio teste virar decorativo: se a varredura parar de achar arquivos,
    // ele continuaria verde sem verificar coisa nenhuma.
    const injetores = arquivos(raiz).filter(
      (arquivo) =>
        !arquivo.endsWith('.module.ts') &&
        readFileSync(arquivo, 'utf8').includes('@Inject(RUNTIME_CONFIG)'),
    );
    assert.ok(
      injetores.length >= 3,
      `Esperava vários injetores de RUNTIME_CONFIG, achei ${injetores.length}.`,
    );
  });
});
