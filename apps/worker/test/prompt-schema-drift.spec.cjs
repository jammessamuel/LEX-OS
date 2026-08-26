let parsers;
let prompts;

beforeAll(async () => {
  parsers = await import('../dist/processing/review-processing.provider.js');
  prompts = await import('@lex-os/ai-prompts');
});

/**
 * O `outputSchema` dos prompts e os validadores escritos à mão têm de exigir a mesma coisa.
 *
 * A validação real de produção vive nos parsers deste worker; o schema do pacote é o contrato
 * declarado. Se divergirem, ninguém acusa — o schema vira documentação mentirosa, que é pior
 * que nenhuma. Mesmo padrão do vocabulary-drift do web, que pegou quatro rótulos faltando na
 * primeira execução.
 */

function timelineEvent() {
  return {
    eventType: 'TESTE',
    title: 'Evento fictício',
    description: 'Descrição fictícia.',
    occurredAt: '2026-08-05T00:00:00.000Z',
    datePrecision: 'DAY',
    importance: 'NORMAL',
    sourceLocator: { pageNumber: 1, startOffset: 0, endOffset: 5 },
    confidenceScore: 0.5,
  };
}

function timelineOutput() {
  return {
    schemaVersion: 1,
    provider: 'p',
    modelName: 'm',
    promptVersion: 'v',
    events: [timelineEvent()],
  };
}

describe('divergência schema × validador', () => {
  it('a cronologia declarada no schema é aceita pelo validador', () => {
    expect(() => parsers.parseTimelineProviderOutputV1(timelineOutput(), 100)).not.toThrow();
  });

  it('o validador exige cada campo que o schema da cronologia exige', () => {
    const requiredTop = prompts.timelinePromptV1.outputSchema.required;
    for (const key of requiredTop) {
      const output = Object.fromEntries(
        Object.entries(timelineOutput()).filter(([k]) => k !== key),
      );
      expect(() => parsers.parseTimelineProviderOutputV1(output, 100)).toThrow();
    }
    const requiredEvent = prompts.timelinePromptV1.outputSchema.properties.events.items.required;
    for (const key of requiredEvent) {
      const output = timelineOutput();
      output.events[0] = Object.fromEntries(
        Object.entries(output.events[0]).filter(([k]) => k !== key),
      );
      expect(() => parsers.parseTimelineProviderOutputV1(output, 100)).toThrow();
    }
  });

  it('todo prompt de cronologia declara o mesmo contrato de saída', () => {
    const timelines = prompts.promptLibrary.filter((p) => p.task === 'TIMELINE');
    for (const prompt of timelines) {
      expect(prompt.outputSchema).toEqual(prompts.timelinePromptV1.outputSchema);
    }
    const checklists = prompts.promptLibrary.filter((p) => p.task === 'CHECKLIST');
    for (const prompt of checklists) {
      expect(prompt.outputSchema).toEqual(prompts.checklistPromptV1.outputSchema);
    }
  });

  it('o checklist declarado no schema é aceito, e status fora do enum é recusado', () => {
    const itemId = '11111111-1111-4111-8111-111111111111';
    const good = {
      schemaVersion: 1,
      provider: 'p',
      modelName: 'm',
      promptVersion: 'v',
      items: [{ templateItemId: itemId, status: 'MISSING' }],
    };
    expect(() => parsers.parseChecklistAnalysisOutputV1(good, [itemId])).not.toThrow();

    const allowed = new Set(
      prompts.checklistPromptV1.outputSchema.properties.items.items.properties.status.enum,
    );
    // O banco tem oito status. A análise propõe cinco: os três que restam — VALIDATED,
    // NOT_APPLICABLE e RECEIVED — são juízo de quem revisa, e a análise nunca preenche
    // validatedBy. Um sexto passando aqui significaria que a porta abriu sem ninguém decidir.
    expect(allowed).toEqual(new Set(parsers.proposableChecklistStatuses));
    expect(allowed).toEqual(
      new Set(['MISSING', 'AWAITING_VALIDATION', 'ILLEGIBLE', 'INVALID', 'EXPIRED']),
    );
    for (const humano of ['VALIDATED', 'NOT_APPLICABLE', 'RECEIVED']) {
      const bad = { ...good, items: [{ templateItemId: itemId, status: humano }] };
      expect(() => parsers.parseChecklistAnalysisOutputV1(bad, [itemId])).toThrow();
    }
  });

  it('aceita os cinco estados que a análise pode propor', () => {
    const itemId = '11111111-1111-4111-8111-111111111111';
    // Ilegível, inválido e vencido eram todos MISSING, que na tela se lê 'não recebemos'.
    // O advogado pedia documento novo, o cliente reenviava o mesmo scan ruim, e o ciclo
    // repetia até a véspera. Estes três existem para o pedido ser o certo.
    for (const status of parsers.proposableChecklistStatuses) {
      const output = {
        schemaVersion: 1,
        provider: 'p',
        modelName: 'm',
        promptVersion: 'v',
        items: [{ templateItemId: itemId, status }],
      };
      expect(() => parsers.parseChecklistAnalysisOutputV1(output, [itemId])).not.toThrow();
    }
  });

  it('aceita toda precisão de data e todo grau de importância do banco', () => {
    // O prompt manda respeitar a precisão escrita. Um validador que só aceitasse DAY forçaria
    // o modelo a carimbar um dia que o documento não dá — data inventada com localizador
    // válido, que é o erro que nenhuma conferência humana pega.
    for (const precisao of parsers.datePrecisions) {
      const output = timelineOutput();
      output.events[0].datePrecision = precisao;
      expect(() => parsers.parseTimelineProviderOutputV1(output, 100)).not.toThrow();
    }
    for (const grau of parsers.importanceLevels) {
      const output = timelineOutput();
      output.events[0].importance = grau;
      expect(() => parsers.parseTimelineProviderOutputV1(output, 100)).not.toThrow();
    }
  });

  it('recusa precisão e importância fora do catálogo', () => {
    for (const [campo, valor] of [
      ['datePrecision', 'SECULO'],
      ['importance', 'URGENTISSIMO'],
    ]) {
      const output = timelineOutput();
      output.events[0][campo] = valor;
      expect(() => parsers.parseTimelineProviderOutputV1(output, 100)).toThrow();
    }
  });

  it('o schema declara os mesmos enums que o validador aceita', () => {
    // Antes de 2026-08-26 o schema da cronologia listava os nomes dos campos e nada mais: os
    // enums viviam só no validador. Schema que não diz o que aceita é documentação muda, e foi
    // gerando o caderno de revisão jurídica que a lacuna apareceu — o advogado revisor não
    // teria como conferir a instrução contra o que a saída comporta.
    const evento = prompts.timelinePromptV1.outputSchema.properties.events.items.properties;
    expect(new Set(evento.datePrecision.enum)).toEqual(new Set(parsers.datePrecisions));
    expect(new Set(evento.importance.enum)).toEqual(new Set(parsers.importanceLevels));
  });

  it('todo campo obrigatório da saída tem propriedade declarada', () => {
    for (const prompt of prompts.promptLibrary) {
      const raiz = prompt.outputSchema.properties ?? {};
      const colecao = Object.values(raiz).find((v) => v.type === 'array' && v.items !== undefined);
      const item = colecao?.items ?? prompt.outputSchema;
      const declarados = new Set(Object.keys(item.properties ?? {}));
      const faltando = (item.required ?? []).filter((campo) => !declarados.has(campo));
      expect({ prompt: prompt.identifier, faltando }).toEqual({
        prompt: prompt.identifier,
        faltando: [],
      });
    }
  });

  it('cada tarefa declara uma entrada só, em toda faixa', () => {
    // A saída já tinha esta guarda; a entrada não, e foi por aí que o genérico ficou para trás
    // duas vezes — declarando um contrato antigo enquanto as faixas seguiam adiante.
    for (const tarefa of prompts.promptTasks) {
      const daTarefa = prompts.promptLibrary.filter((p) => p.task === tarefa);
      expect(daTarefa.length).toBeGreaterThan(1);
      const entradas = new Set(daTarefa.map((p) => JSON.stringify(p.inputSchema)));
      expect(entradas.size).toBe(1);
    }
  });

  it('a entrada carrega o texto do documento nas tarefas que o leem', () => {
    // O defeito que isto guarda: cronologia recebia só o comprimento do texto, checklist só
    // códigos de tipo, e classificação e entidades não recebiam argumento nenhum — enquanto as
    // quatro instruções mandavam ler o documento. Só apareceria no primeiro provedor real.
    for (const tarefa of ['TIMELINE', 'CHECKLIST', 'CLASSIFICATION', 'ENTITIES']) {
      const entrada = prompts.promptLibrary.find((p) => p.task === tarefa).inputSchema;
      const campo = entrada.properties.sourceText;
      // Jest não aceita mensagem no expect; o nome da tarefa entra na própria asserção.
      expect({ tarefa, recebeTexto: campo !== undefined }).toEqual({ tarefa, recebeTexto: true });
      const forma = campo.oneOf === undefined ? campo : campo.oneOf[0];
      expect(new Set(forma.required)).toEqual(new Set(['content', 'totalLength', 'truncated']));
    }
  });

  it('o checklist recebe o enunciado da exigência, não só o código de tipo', () => {
    // Sem o enunciado o modelo não sabe que o item pede "matrícula atualizada", e o julgamento
    // vira comparação de duas strings — o que o mock determinístico já faz sem modelo nenhum.
    const item = prompts.checklistPromptV1.inputSchema.properties.items.items;
    expect(new Set(item.required)).toEqual(
      new Set(['id', 'documentTypeCode', 'title', 'description', 'isRequired']),
    );
  });

  it('campo extra é recusado dos dois lados', () => {
    expect(prompts.timelinePromptV1.outputSchema.additionalProperties).toBe(false);
    const output = timelineOutput();
    output.extra = 'x';
    expect(() => parsers.parseTimelineProviderOutputV1(output, 100)).toThrow();
  });
});
