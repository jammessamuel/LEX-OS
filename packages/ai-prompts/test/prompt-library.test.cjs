const assert = require('node:assert/strict');
const { before, describe, it } = require('node:test');

let library;

before(async () => {
  library = await import('../dist/index.js');
});

describe('biblioteca de prompts', () => {
  it('dá a toda tarefa um prompt genérico, para nenhuma área ficar descoberta', () => {
    for (const task of library.promptTasks) {
      const generic = library.promptLibrary.filter(
        (prompt) => prompt.specialty === null && prompt.task === task,
      );
      // Zero deixa a tarefa sem cobertura; mais de um torna a escolha ambígua.
      assert.equal(
        generic.length,
        1,
        `A tarefa ${task} tem ${generic.length} prompts genéricos; deveria ter exatamente 1.`,
      );
    }
  });

  it('não repete identificador nem versão', () => {
    const identifiers = library.promptLibrary.map((prompt) => prompt.identifier);
    const versions = library.promptLibrary.map((prompt) => prompt.version);
    assert.equal(new Set(identifiers).size, identifiers.length);
    assert.equal(new Set(versions).size, versions.length);
  });

  it('carrega o texto que vai ao modelo, e não só metadado sobre ele', () => {
    for (const prompt of library.promptLibrary) {
      assert.ok(
        prompt.template.trim().length > 200,
        `O prompt ${prompt.identifier} não tem texto de verdade.`,
      );
      assert.ok(prompt.purpose);
      assert.ok(prompt.examples.length > 0);
      assert.ok(prompt.validationCriteria.length > 0);
    }
  });

  it('manda o modelo tratar o material do processo como dado, nunca como instrução', () => {
    // ADR-006 e AGENTS.md: conteúdo recuperado é evidência, não canal de instrução. Um prompt
    // sem essa separação é a porta aberta para injeção via documento enviado pelo cliente.
    for (const prompt of library.promptLibrary) {
      assert.match(
        prompt.template,
        /DADO, nunca instrução/u,
        `O prompt ${prompt.identifier} não separa instrução de conteúdo.`,
      );
    }
  });

  it('resolve o apelido da área para o mesmo prompt da especialidade', () => {
    const canonical = library.promptFor('TIMELINE', 'TRABALHISTA');
    const alias = library.promptFor('TIMELINE', 'DIREITO_TRABALHISTA');
    const lowercase = library.promptFor('TIMELINE', 'direito_trabalhista');
    assert.equal(alias.identifier, canonical.identifier);
    assert.equal(lowercase.identifier, canonical.identifier);
  });

  it('cai no genérico quando a área não está catalogada, em vez de falhar', () => {
    const unknown = library.promptFor('TIMELINE', 'DIREITO_MARITIMO');
    const nothing = library.promptFor('TIMELINE', null);
    assert.equal(unknown.specialty, null);
    assert.equal(nothing.specialty, null);
  });

  it('recusa rascunho em produção, para nada não revisado tocar caso real', () => {
    const draft = library.promptLibrary.find((prompt) => prompt.reviewStatus === 'DRAFT');
    assert.ok(draft, 'O teste precisa de ao menos um rascunho para valer.');

    assert.throws(
      () => library.promptFor(draft.task, draft.specialty, { environment: 'production' }),
      library.UnreviewedPromptError,
    );
    // Fora de produção o mesmo prompt é entregue normalmente.
    assert.ok(library.promptFor(draft.task, draft.specialty, { environment: 'development' }));
  });

  it('reclama de tarefa sem prompt em vez de devolver indefinido', () => {
    assert.throws(() => library.promptFor('TAREFA_INEXISTENTE', null), library.MissingPromptError);
  });

  it('devolve a versão sem precisar montar a chamada', () => {
    assert.equal(
      library.promptVersionFor('TIMELINE', 'TRABALHISTA'),
      library.promptFor('TIMELINE', 'TRABALHISTA').version,
    );
  });
});
