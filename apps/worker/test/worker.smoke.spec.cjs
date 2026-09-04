let WorkerService;
let MockProcessingProvider;
let MockReviewProcessingProvider;

beforeAll(async () => {
  ({ WorkerService } = await import('../dist/worker.service.js'));
  ({ MockProcessingProvider } = await import('../dist/processing/mock-processing.provider.js'));
  ({ MockReviewProcessingProvider } =
    await import('../dist/processing/review-processing.provider.js'));
});

describe('WorkerService', () => {
  it('reports that the persistent processing pipeline is active', () => {
    const service = new WorkerService();

    expect(service.getStatus()).toEqual({
      name: 'lex-os-worker',
      processingPipeline: 'active',
      status: 'ready',
    });
  });

  it('refuses deterministic processing mocks in production', () => {
    expect(() => new MockProcessingProvider({ environment: 'production' })).toThrow(
      /cannot run in production/u,
    );
    expect(() => new MockReviewProcessingProvider({ environment: 'production' })).toThrow(
      /cannot run in production/u,
    );
  });
});

describe('dados identificados no documento', () => {
  const textoDe = (conteudo) => ({
    content: conteudo,
    totalLength: conteudo.length,
    truncated: false,
  });

  it('recorta o dado que está escrito, no lugar em que está', () => {
    // O extrator devolvia sempre o contrato 'LEX-2026-0001' e a data '05/08/2026', com
    // deslocamentos fixos. Num cartão de ponto de março a tela mostrava as duas como "dados
    // identificados", com botão de confirmar ao lado — e confirmar é ato humano que vale.
    const provider = new MockProcessingProvider({ environment: 'test' });
    const texto =
      'Empregador Vale Sereno Ltda., CNPJ 11.222.333/0001-44.\n' +
      'Empregado Ronaldo, CPF 111.222.333-96, salario R$ 2.840,00 desde 03/02/2020.';
    const { entities } = provider.extractEntities({ sourceText: textoDe(texto) });

    expect(entities.map((e) => e.entityType)).toEqual(['CNPJ', 'CPF', 'MONETARY_VALUE', 'DATE']);
    // Cada recorte tem de devolver exatamente o dado — localizador que aponta para outro
    // trecho convida a conferir e mente na conferência.
    for (const entidade of entities) {
      expect(texto.slice(entidade.startOffset, entidade.endOffset)).toBe(entidade.originalValue);
    }
    // A forma canônica existe para somar e comparar sem reinterpretar o texto.
    expect(entities[2].normalizedValue).toBe('2840.00');
    expect(entities[3].normalizedValue).toBe('2020-02-03');
  });

  it('devolve lista vazia quando o documento não traz nenhum desses dados', () => {
    const provider = new MockProcessingProvider({ environment: 'test' });
    const { entities } = provider.extractEntities({
      sourceText: textoDe('Procuracao ficticia sem numero, sem data e sem valor.'),
    });
    expect(entities).toEqual([]);
  });
});
