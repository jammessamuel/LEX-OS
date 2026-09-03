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

// O texto do documento entrou na entrada em 2026-08-26. Montar aqui a forma real, e não a
// mínima que o mock aceita, é o que faz este teste falhar quando o contrato mudar de novo.
const textoDe = (conteudo) => ({
  content: conteudo,
  totalLength: conteudo.length,
  truncated: false,
});

describe('provedores determinísticos de revisão', () => {
  it('produz cronologia versionada e vinculável à fonte', () => {
    const provider = new MockReviewProcessingProvider({ environment: 'test' });
    const result = provider.generate({
      sourceTextLength: 100,
      sourceText: textoDe('Contrato ficticio celebrado em 05/08/2026.'),
      prompt: promptDe('TIMELINE'),
    });

    // A versão vem do prompt resolvido, não de um literal: o que este teste garante é que o
    // provedor carimba a procedência que recebeu. Fixar a string aqui só faria o teste quebrar
    // a cada revisão de texto, ensinando a atualizar o número sem olhar o que mudou.
    expect(result).toMatchObject({
      schemaVersion: 1,
      provider: 'lex-os-mock-timeline',
      promptVersion: promptDe('TIMELINE').version,
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
          outcome: 'ANALYZED',
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
      sourceText: textoDe('Documento ficticio para conferencia.'),
      // A data contra a qual a validade se afere. O mock não julga vigência e não a usa, mas a
      // fixture monta a chamada real: entrada incompleta aqui descreveria um contrato que o
      // worker não faz, e é assim que um teste passa enquanto a produção quebra.
      referenceDate: '2026-09-03',
      items: [
        {
          id: 'item-a',
          documentTypeCode: 'RG',
          title: 'Documento de identidade',
          description: 'Frente e verso legiveis.',
          isRequired: true,
        },
        {
          id: 'item-b',
          documentTypeCode: 'OUTRO',
          title: 'Outros documentos do caso',
          description: null,
          isRequired: false,
        },
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
