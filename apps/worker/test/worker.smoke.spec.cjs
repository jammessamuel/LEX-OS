let WorkerService;
let MockProcessingProvider;
let MockReviewProcessingProvider;
let readBodyAtMost;

beforeAll(async () => {
  ({ WorkerService } = await import('../dist/worker.service.js'));
  ({ MockProcessingProvider } = await import('../dist/processing/mock-processing.provider.js'));
  ({ MockReviewProcessingProvider } =
    await import('../dist/processing/review-processing.provider.js'));
  ({ readBodyAtMost } = await import('../dist/storage/s3-object-reader.js'));
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
    // Os identificadores da fixture têm dígito verificador válido desde que a extração passou a
    // conferi-lo: fixture com CNPJ inválido descreveria um documento que o sistema recusa.
    const texto =
      'Empregador Vale Sereno Ltda., CNPJ 34.028.316/0001-03.\n' +
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

  it('cada valor sai com a frase que diz o que ele é', () => {
    // "R$ 148.320,55" sozinho não identifica nada num processo tributário: falta a rubrica, a
    // competência e a peça. As instruções mandavam devolver esses atributos e a saída não tinha
    // onde — o que sobrava era espremê-los no valor original, e aí o par de deslocamentos
    // deixava de recortar o próprio dado.
    const provider = new MockProcessingProvider({ environment: 'test' });
    const texto =
      'DEMONSTRATIVO DO AUTO\nMulta de oficio, competencia 03/2024: R$ 148.320,55\nJuros: R$ 12.004,10';
    const { entities } = provider.extractEntities({ sourceText: textoDe(texto) });

    expect(entities).toHaveLength(2);
    expect(entities[0].context).toContain('Multa de oficio');
    expect(entities[0].context).toContain('competencia 03/2024');
    expect(entities[1].context).toContain('Juros');

    // A separação é o ponto: o contexto qualifica, o intervalo continua recortando só o número.
    // Espremer a qualificação no valor faria o localizador deixar de conferir.
    for (const entidade of entities) {
      expect(texto.slice(entidade.startOffset, entidade.endOffset)).toBe(entidade.originalValue);
      expect(entidade.originalValue).not.toContain('competencia');
    }
  });

  it('descarta CPF e CNPJ que só têm o formato, não o dígito', () => {
    // Formato não distingue documento de ruído: digitalização troca dígito, formulário traz
    // exemplo preenchido, e onze algarismos pontuados passam por CPF em qualquer expressão. Foi
    // o cadastro de pessoa que denunciou — ele recusa identificador inválido na entrada, e os
    // números dos documentos fictícios não passavam, enquanto a extração os apresentava como se
    // fossem CPF. Mesma classe da data 31/02 aceita como data.
    const provider = new MockProcessingProvider({ environment: 'test' });
    const texto =
      'Valido: CPF 111.222.333-96 e CNPJ 34.028.316/0001-03.\n' +
      'Invalidos: CPF 444.555.666-11 e CNPJ 11.222.333/0001-44.';
    const { entities } = provider.extractEntities({ sourceText: textoDe(texto) });

    expect(entities.map((e) => e.originalValue)).toEqual(['111.222.333-96', '34.028.316/0001-03']);
  });

  it('devolve lista vazia quando o documento não traz nenhum desses dados', () => {
    const provider = new MockProcessingProvider({ environment: 'test' });
    const { entities } = provider.extractEntities({
      sourceText: textoDe('Procuracao ficticia sem numero, sem data e sem valor.'),
    });
    expect(entities).toEqual([]);
  });

  it('descarta data impossível em vez de oferecer uma normalização falsa para confirmação', () => {
    const provider = new MockProcessingProvider({ environment: 'test' });
    const { entities } = provider.extractEntities({
      sourceText: textoDe('Vencimento impossível em 31/02/2026.'),
    });
    expect(entities).toEqual([]);
  });
});

describe('leitura limitada do objeto', () => {
  async function* blocos(...values) {
    for (const value of values) {
      yield Buffer.from(value);
    }
  }

  it('não declara corte quando o objeto termina exatamente no teto', async () => {
    const result = await readBodyAtMost(blocos('ab', 'cd'), 4);

    expect(result.body.toString('utf8')).toBe('abcd');
    expect(result.truncated).toBe(false);
  });

  it('detecta conteúdo depois de um bloco que terminou exatamente no teto', async () => {
    const result = await readBodyAtMost(blocos('abcd', 'ef'), 4);

    expect(result.body.toString('utf8')).toBe('abcd');
    expect(result.truncated).toBe(true);
  });

  it('corta um bloco maior sem ultrapassar o limite entregue ao chamador', async () => {
    const result = await readBodyAtMost(blocos('abcdef'), 4);

    expect(result.body.toString('utf8')).toBe('abcd');
    expect(result.truncated).toBe(true);
  });
});
