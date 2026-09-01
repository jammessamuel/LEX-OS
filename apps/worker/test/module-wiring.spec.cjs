const { readdirSync, readFileSync, statSync } = require('node:fs');
const { join, dirname, basename } = require('node:path');

/**
 * Guarda de fiação de módulo, no worker.
 *
 * Irmão do teste que existe na API, e escrito depois de o mesmo defeito acontecer duas vezes:
 * um serviço passa a injetar um token, o módulo dele não fornece o token, e nada acusa — o
 * TypeScript não vê porque a resolução é do Nest, na inicialização. Da primeira vez a API não
 * subiu e o job de integração ficou pendurado vinte minutos; da segunda foi
 * `TextExtractionService` injetando `OBJECT_READER` sem o `StorageModule` no lugar.
 *
 * A diferença para o irmão da API é a cobertura: aqui todos os tokens de módulo entram, não só
 * a configuração. Foi a lacuna do primeiro que deixou o segundo passar.
 */

const raiz = join(__dirname, '..', 'src');

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

/** Token → módulo que o fornece. Descoberto do código, não mantido à mão. */
function catalogoDeTokens(todos) {
  const catalogo = new Map();
  for (const arquivo of todos) {
    const fonte = readFileSync(arquivo, 'utf8');
    for (const [, token] of fonte.matchAll(/export const ([A-Z_]+) = Symbol\(/gu)) {
      const pasta = dirname(arquivo);
      const modulo = readdirSync(pasta).find((nome) => nome.endsWith('.module.ts'));
      if (modulo !== undefined) {
        const nomeClasse = /export class (\w+Module)/u.exec(
          readFileSync(join(pasta, modulo), 'utf8'),
        );
        if (nomeClasse !== null) {
          catalogo.set(token, { modulo: nomeClasse[1], pasta });
        }
      }
    }
  }
  return catalogo;
}

describe('fiação dos módulos do worker', () => {
  const todos = arquivos(raiz);
  const catalogo = catalogoDeTokens(todos);

  it('descobre os tokens de módulo em vez de depender de uma lista à mão', () => {
    // Lista mantida à mão envelhece em silêncio, e um teste que envelhece em silêncio é pior
    // que teste nenhum: ele dá a impressão de cobertura que já não existe.
    expect(catalogo.size).toBeGreaterThanOrEqual(6);
    expect([...catalogo.keys()]).toContain('OBJECT_READER');
    expect([...catalogo.keys()]).toContain('RUNTIME_CONFIG');
  });

  it('quem injeta um token está num módulo que o fornece ou o importa', () => {
    const pendencias = [];
    for (const arquivo of todos) {
      if (arquivo.endsWith('.module.ts')) {
        continue;
      }
      const fonte = readFileSync(arquivo, 'utf8');
      const pasta = dirname(arquivo);
      const modulos = readdirSync(pasta).filter((nome) => nome.endsWith('.module.ts'));
      if (modulos.length === 0) {
        continue;
      }
      const fonteModulo = modulos.map((nome) => readFileSync(join(pasta, nome), 'utf8')).join('\n');
      const importados = /imports:\s*\[([\s\S]*?)\]/u.exec(fonteModulo)?.[1] ?? '';
      const declarados = /providers:\s*\[([\s\S]*?)\n {2}\]/u.exec(fonteModulo)?.[1] ?? fonteModulo;

      for (const [, token] of fonte.matchAll(/@Inject\(([A-Z_]+)\)/gu)) {
        const origem = catalogo.get(token);
        if (origem === undefined) {
          continue;
        }
        // Vale se o próprio módulo fornece o token, ou se ele importa o módulo que fornece.
        const proprio = origem.pasta === pasta || declarados.includes(token);
        if (!proprio && !importados.includes(origem.modulo)) {
          pendencias.push(`${basename(arquivo)} injeta ${token} sem ${origem.modulo} nos imports`);
        }
      }
    }
    expect(pendencias).toEqual([]);
  });
});
