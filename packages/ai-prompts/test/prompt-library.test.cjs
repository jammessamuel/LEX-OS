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
    const ficticio = { caseArchive: 'fictional' };
    const canonical = library.promptFor('TIMELINE', 'TRABALHISTA', ficticio);
    const alias = library.promptFor('TIMELINE', 'DIREITO_TRABALHISTA', ficticio);
    const lowercase = library.promptFor('TIMELINE', 'direito_trabalhista', ficticio);
    assert.equal(alias.identifier, canonical.identifier);
    assert.equal(lowercase.identifier, canonical.identifier);
  });

  it('cai no genérico quando a área não está catalogada, em vez de falhar', () => {
    const unknown = library.promptFor('TIMELINE', 'DIREITO_MARITIMO', {
      caseArchive: 'fictional',
    });
    const nothing = library.promptFor('TIMELINE', null, { caseArchive: 'fictional' });
    assert.equal(unknown.specialty, null);
    assert.equal(nothing.specialty, null);
  });

  it('a revisão envelhece quando o texto muda, e o prompt volta a precisar de revisão', () => {
    // O campo que mais trabalha é reviewedVersion. Sem ele uma assinatura de 2026 cobriria um
    // texto reescrito em 2027, que é a forma mais silenciosa de a marca deixar de valer.
    const base = {
      identifier: 'lex-os.teste.envelhecida',
      version: 'v2',
      reviewStatus: 'REVIEWED',
      review: {
        capacity: 'LAWYER',
        name: 'Fulana de Tal',
        oab: 'OAB/DF 000.000',
        standing: null,
        date: '2026-08-01',
        reviewedVersion: 'v1',
        note: 'Revisão fictícia de teste.',
      },
    };
    assert.match(library.reviewGapFor(base), /covers version v1, not v2/u);
    assert.throws(() => library.assertUsableIn(base, 'real'), library.UnreviewedPromptError);

    const atual = { ...base, review: { ...base.review, reviewedVersion: 'v2' } };
    assert.equal(library.reviewGapFor(atual), null);
    assert.doesNotThrow(() => library.assertUsableIn(atual, 'real'));
  });

  it('recusa atestação de advogado sem número de inscrição', () => {
    // Aprovação do dono pode não ter inscrição — ela cobre comportamento de mock. Atestação que
    // se declara de advogado, não: é dela que sai a responsabilidade pelo conteúdo jurídico.
    const semInscricao = {
      identifier: 'lex-os.teste.sem-oab',
      version: 'v1',
      reviewStatus: 'REVIEWED',
      review: {
        capacity: 'LAWYER',
        name: 'Fulana de Tal',
        oab: null,
        standing: 'Inscrição licenciada.',
        date: '2026-08-26',
        reviewedVersion: 'v1',
        note: 'Revisão fictícia de teste.',
      },
    };
    assert.match(library.reviewGapFor(semInscricao), /no bar registration/u);
  });

  it('toda atestação diz quem assinou, em que qualidade e contra qual versão', () => {
    for (const prompt of library.promptLibrary) {
      if (prompt.reviewStatus === 'DRAFT') {
        assert.equal(prompt.review, null, prompt.identifier);
        continue;
      }
      const r = prompt.review;
      assert.ok(r !== null, `${prompt.identifier} está REVIEWED sem atestação.`);
      assert.ok(['LAWYER', 'OWNER'].includes(r.capacity), prompt.identifier);
      assert.ok(r.name.length > 3, prompt.identifier);
      assert.match(r.date, /^\d{4}-\d{2}-\d{2}$/u, prompt.identifier);
      assert.equal(r.reviewedVersion, prompt.version, `${prompt.identifier}: revisão envelhecida.`);
      assert.ok(r.note.length > 20, `${prompt.identifier}: atestação sem escopo declarado.`);
      // Inscrição ausente exige dizer por quê, para o registro não fingir o que não há.
      if (r.oab === null) {
        assert.ok(r.standing !== null && r.standing.length > 10, prompt.identifier);
      }
    }
  });

  it('recusa rascunho sobre acervo real, e recusa também quando ninguém disse qual é', () => {
    // Rascunho sintético: a garantia não pode depender de existir rascunho na biblioteca,
    // senão ela some justamente quando tudo estiver aprovado.
    const rascunho = { identifier: 'lex-os.teste.rascunho', reviewStatus: 'DRAFT', review: null };
    for (const acervo of ['real', undefined, '', 'production', 'development', 'homologacao']) {
      assert.throws(
        () => library.assertUsableIn(rascunho, acervo),
        library.UnreviewedPromptError,
        `Acervo "${String(acervo)}" deixou passar um rascunho.`,
      );
    }
    assert.doesNotThrow(() => library.assertUsableIn(rascunho, 'fictional'));
  });

  it('não confunde o nome do ambiente com a natureza do dado', () => {
    // Este é o buraco que a guarda antiga tinha: um laptop apontado para a base de um cliente
    // roda com NODE_ENV=development, e passava inteiro. Nome de processo não mede risco.
    const rascunho = { identifier: 'lex-os.teste.laptop', reviewStatus: 'DRAFT', review: null };
    assert.throws(
      () => library.assertUsableIn(rascunho, 'development'),
      library.UnreviewedPromptError,
    );
  });

  it('a recusa sobre acervo real acompanha exatamente a lacuna da atestação', () => {
    // "REVIEWED" não basta por si: a atestação precisa cobrir esta versão do texto e, quando se
    // declara de advogado, carregar a inscrição. A guarda e o diagnóstico têm de contar a mesma
    // história — se divergirem, o erro que a pessoa lê deixa de explicar a recusa.
    for (const prompt of library.promptLibrary) {
      const lacuna = library.reviewGapFor(prompt);
      if (lacuna === null) {
        assert.doesNotThrow(() => library.assertUsableIn(prompt, 'real'), prompt.identifier);
      } else {
        assert.throws(
          () => library.assertUsableIn(prompt, 'real'),
          library.UnreviewedPromptError,
          prompt.identifier,
        );
      }
    }
  });

  it('mantém os quinze prompts especializados como rascunho até a atestação válida', () => {
    // ADR-016: leitura preliminar sem inscrição ativa não é atestação jurídica. Guardar o nome
    // dentro de `review` enquanto o status dizia REVIEWED contava duas histórias diferentes — a
    // guarda recusava, mas o catálogo parecia aprovado. O estado agora é único e inequívoco.
    const especialidade = library.promptLibrary.filter((p) => p.specialty !== null);
    assert.equal(especialidade.length, 15);
    for (const prompt of especialidade) {
      assert.equal(prompt.reviewStatus, 'DRAFT', prompt.identifier);
      assert.equal(prompt.review, null, prompt.identifier);
      assert.match(library.reviewGapFor(prompt), /still a draft/u, prompt.identifier);
      assert.throws(
        () => library.assertUsableIn(prompt, 'real'),
        library.UnreviewedPromptError,
        prompt.identifier,
      );
    }
  });

  it('mantém aprovados os cinco genéricos, que descrevem o comportamento determinístico', () => {
    // Decisão do dono em 2026-08-25. Prompt de especialidade, vindo de pesquisa automatizada,
    // continua nascendo rascunho.
    for (const prompt of library.promptLibrary.filter((p) => p.specialty === null)) {
      assert.equal(prompt.reviewStatus, 'REVIEWED', prompt.identifier);
    }
  });

  it('resolve as cinco tarefas em cada faixa, que é o que o worker agora pede', () => {
    const tarefas = ['CLASSIFICATION', 'ENTITIES', 'TIMELINE', 'CHECKLIST', 'GROUNDED_ANSWER'];
    for (const area of ['TRABALHISTA', 'CIVEL', 'CRIMINAL']) {
      for (const tarefa of tarefas) {
        const escolhido = library.promptFor(tarefa, area, { caseArchive: 'fictional' });
        assert.equal(escolhido.task, tarefa);
        assert.equal(escolhido.specialty, area, `${area}/${tarefa} caiu no genérico.`);
        assert.ok(escolhido.template.length > 400, `${area}/${tarefa} tem template curto.`);
      }
    }
  });

  it('reclama de tarefa sem prompt em vez de devolver indefinido', () => {
    assert.throws(() => library.promptFor('TAREFA_INEXISTENTE', null), library.MissingPromptError);
  });

  it('devolve a versão sem precisar montar a chamada', () => {
    const ficticio = { caseArchive: 'fictional' };
    assert.equal(
      library.promptVersionFor('TIMELINE', 'TRABALHISTA', ficticio),
      library.promptFor('TIMELINE', 'TRABALHISTA', ficticio).version,
    );
  });
});
