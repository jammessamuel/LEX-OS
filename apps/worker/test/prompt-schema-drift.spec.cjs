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
    // O banco tem oito status; o contrato só aceita dois. Um terceiro passando aqui
    // significaria que schema e validador abriram a porta sem ninguém decidir.
    expect(allowed).toEqual(new Set(['MISSING', 'AWAITING_VALIDATION']));
    const bad = { ...good, items: [{ templateItemId: itemId, status: 'VALIDATED' }] };
    expect(() => parsers.parseChecklistAnalysisOutputV1(bad, [itemId])).toThrow();
  });

  it('campo extra é recusado dos dois lados', () => {
    expect(prompts.timelinePromptV1.outputSchema.additionalProperties).toBe(false);
    const output = timelineOutput();
    output.extra = 'x';
    expect(() => parsers.parseTimelineProviderOutputV1(output, 100)).toThrow();
  });
});
