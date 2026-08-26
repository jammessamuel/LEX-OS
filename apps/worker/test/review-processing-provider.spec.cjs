let prompts;
let MockReviewProcessingProvider;
let parseChecklistAnalysisOutputV1;
let parseTimelineProviderOutputV1;

beforeAll(async () => {
  ({ MockReviewProcessingProvider, parseChecklistAnalysisOutputV1, parseTimelineProviderOutputV1 } =
    await import('../dist/processing/review-processing.provider.js'));
  prompts = await import('@lex-os/ai-prompts');
});

// O prompt agora vem de fora: quem chama escolhe pela área do caso, e o provedor carimba a
// versão do que recebeu. Aqui basta o genérico, que é aprovado e não depende da guarda.
const promptDe = (tarefa) => prompts.promptFor(tarefa, null, { caseArchive: 'fictional' });

describe('provedores determinísticos de revisão', () => {
  it('produz cronologia versionada e vinculável à fonte', () => {
    const provider = new MockReviewProcessingProvider({ environment: 'test' });
    const result = provider.generate({
      sourceTextLength: 100,
      prompt: promptDe('TIMELINE'),
    });

    expect(result).toMatchObject({
      schemaVersion: 1,
      provider: 'lex-os-mock-timeline',
      promptVersion: 'timeline-mock-v1',
    });
    expect(result.events).toHaveLength(1);
    expect(result.events[0].sourceLocator).toEqual({
      pageNumber: 1,
      startOffset: 47,
      endOffset: 57,
    });
  });

  it('rejeita localizador fora do texto autorizado', () => {
    expect(() =>
      parseTimelineProviderOutputV1(
        {
          schemaVersion: 1,
          provider: 'fixture',
          modelName: 'v1',
          promptVersion: 'v1',
          events: [
            {
              eventType: 'DATE',
              title: 'Evento fictício',
              description: 'Fixture',
              occurredAt: '2026-08-05T00:00:00.000Z',
              datePrecision: 'DAY',
              importance: 'NORMAL',
              sourceLocator: { pageNumber: 1, startOffset: 47, endOffset: 57 },
              confidenceScore: 0.9,
            },
          ],
        },
        40,
      ),
    ).toThrow(/authorized source/u);
  });

  it('classifica somente o item correspondente ao tipo documental', () => {
    const provider = new MockReviewProcessingProvider({ environment: 'test' });
    const result = provider.analyze({
      documentTypeCode: 'OUTRO',
      items: [
        { id: 'item-a', documentTypeCode: 'RG' },
        { id: 'item-b', documentTypeCode: 'OUTRO' },
      ],
      prompt: promptDe('CHECKLIST'),
    });

    expect(result.items).toEqual([
      { templateItemId: 'item-a', status: 'MISSING' },
      { templateItemId: 'item-b', status: 'AWAITING_VALIDATION' },
    ]);
    expect(() =>
      parseChecklistAnalysisOutputV1(
        {
          ...result,
          items: [
            { templateItemId: 'item-a', status: 'MISSING' },
            { templateItemId: 'item-a', status: 'MISSING' },
          ],
        },
        ['item-a', 'item-b'],
      ),
    ).toThrow(/item analysis/u);
  });
});
