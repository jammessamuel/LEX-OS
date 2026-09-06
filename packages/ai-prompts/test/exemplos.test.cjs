const assert = require('node:assert/strict');
const { before, describe, it } = require('node:test');

let library;

before(async () => {
  library = await import('../dist/index.js');
});

/**
 * Todo campo citado num exemplo existe no schema correspondente.
 *
 * Os `examples` de cada prompt são fragmentos ilustrativos, não instâncias completas: mostram a
 * forma do evento, do item ou da afirmação, sem repetir o envelope com `schemaVersion`,
 * `provider` e `modelName`. Isso é deliberado — quem lê o exemplo, inclusive o advogado que
 * revisa o caderno, quer ver a parte que decide, não o cabeçalho de transporte.
 *
 * O que **não** pode é o exemplo citar campo que não existe. Uma revisão adversarial encontrou
 * `itemDocumentTypeCode` num exemplo de checklist, campo que `CHECKLIST_INPUT` nunca teve: o
 * exemplo documentava um contrato imaginário, e ninguém acusava porque nenhum teste os conferia.
 * Exemplo é a primeira coisa que se copia ao escrever um provedor real.
 */

/** Todo nome de propriedade que o schema admite, em qualquer profundidade. */
function camposDe(schema, encontrados = new Set()) {
  if (schema === null || typeof schema !== 'object') {
    return encontrados;
  }
  if (schema.properties !== undefined) {
    for (const [nome, sub] of Object.entries(schema.properties)) {
      encontrados.add(nome);
      camposDe(sub, encontrados);
    }
  }
  for (const chave of ['items', 'not']) {
    camposDe(schema[chave], encontrados);
  }
  for (const chave of ['oneOf', 'anyOf', 'allOf']) {
    for (const alternativa of schema[chave] ?? []) {
      camposDe(alternativa, encontrados);
    }
  }
  return encontrados;
}

/** Todo nome de chave usado no exemplo, em qualquer profundidade. */
function chavesDe(valor, encontradas = new Set()) {
  if (Array.isArray(valor)) {
    for (const item of valor) {
      chavesDe(item, encontradas);
    }
    return encontradas;
  }
  if (valor !== null && typeof valor === 'object') {
    for (const [nome, sub] of Object.entries(valor)) {
      encontradas.add(nome);
      chavesDe(sub, encontradas);
    }
  }
  return encontradas;
}

describe('exemplos das especificações', () => {
  it('não citam campo que o schema não tem', () => {
    const invencoes = [];
    for (const prompt of library.promptLibrary) {
      const permitidos = {
        input: camposDe(prompt.inputSchema),
        output: camposDe(prompt.outputSchema),
      };
      for (const exemplo of prompt.examples) {
        for (const lado of ['input', 'output']) {
          if (exemplo[lado] === undefined) {
            continue;
          }
          for (const chave of chavesDe(exemplo[lado])) {
            if (!permitidos[lado].has(chave)) {
              invencoes.push(`${prompt.identifier} · ${lado}.${chave}`);
            }
          }
        }
      }
    }
    assert.deepEqual(invencoes, []);
  });

  it('todo exemplo mostra entrada e saída, que é o par que ele existe para mostrar', () => {
    const incompletos = library.promptLibrary
      .flatMap((p) => p.examples.map((e) => ({ id: p.identifier, e })))
      .filter(({ e }) => e.input === undefined || e.output === undefined)
      .map(({ id }) => id);
    assert.deepEqual(incompletos, []);
  });
});
