const assert = require('node:assert/strict');
const { describe, it, mock } = require('node:test');

/**
 * O adaptador de modelo real.
 *
 * Dois pontos merecem teste antes de qualquer outro: a recusa sobre acervo real, que é a
 * promessa do ADR-012, e o cálculo de custo, que é dinheiro e não se conserta depois.
 */

let AnthropicGroundedLanguageModelProvider;

function config(overrides = {}) {
  return {
    environment: 'test',
    caseArchive: 'fictional',
    languageModel: {
      provider: 'anthropic',
      apiKey: 'chave-ficticia-de-teste-000000',
      modelName: 'modelo-ficticio',
      inputCostPerMillionTokens: '3',
      outputCostPerMillionTokens: '15',
    },
    ...overrides,
  };
}

const prompt = { version: 'grounded-answer-trabalhista-v1', template: 'INSTRUÇÃO FICTÍCIA.' };
const sources = [{ chunkId: 'chunk-1', content: 'Texto fictício do documento.' }];

function resposta(corpo) {
  return {
    ok: true,
    status: 200,
    json: async () => corpo,
  };
}

describe('AnthropicGroundedLanguageModelProvider', () => {
  it('recusa existir sobre acervo real, e diz por quê', async () => {
    ({ AnthropicGroundedLanguageModelProvider } =
      await import('../../dist/assistant/anthropic-grounded-language-model.provider.js'));
    // A recusa é na construção e não na chamada: assim a instalação errada falha na partida,
    // em vez de descobrir o problema com um documento de cliente já enviado.
    assert.throws(
      () => new AnthropicGroundedLanguageModelProvider(config({ caseArchive: 'real' })),
      /fictional case archive/u,
    );
  });

  it('recusa subir sem chave, em vez de falhar na primeira pergunta', async () => {
    const semChave = config();
    semChave.languageModel = { ...semChave.languageModel, apiKey: '' };
    assert.throws(
      () => new AnthropicGroundedLanguageModelProvider(semChave),
      /API_KEY is required/u,
    );
  });

  it('calcula o custo com inteiros, porque seis casas somadas num mês são dinheiro', async () => {
    const provider = new AnthropicGroundedLanguageModelProvider(config());
    mock.method(globalThis, 'fetch', async () =>
      resposta({
        model: 'modelo-ficticio-20260101',
        usage: { input_tokens: 1_000_000, output_tokens: 200_000 },
        content: [{ type: 'text', text: '{"claims":[{"text":"a","sourceChunkIds":["chunk-1"]}]}' }],
      }),
    );
    const saida = await provider.generate({ prompt, question: 'pergunta', sources });
    mock.restoreAll();

    // 1.000.000 de entrada a 3 por milhão, mais 200.000 de saída a 15 por milhão: 3 + 3 = 6.
    assert.equal(saida.costAmount, '6.000000');
    assert.equal(saida.costCurrency, 'BRL');
    assert.equal(saida.promptVersion, 'grounded-answer-trabalhista-v1');
    // A versão do modelo vem do fornecedor quando ele informa: é ela que a procedência guarda.
    assert.equal(saida.modelVersion, 'modelo-ficticio-20260101');
  });

  it('não arredonda para zero um uso pequeno', async () => {
    const provider = new AnthropicGroundedLanguageModelProvider(config());
    mock.method(globalThis, 'fetch', async () =>
      resposta({
        usage: { input_tokens: 1000, output_tokens: 500 },
        content: [{ type: 'text', text: '{"claims":[]}' }],
      }),
    );
    const saida = await provider.generate({ prompt, question: 'p', sources });
    mock.restoreAll();

    // 1000 a 3/milhão = 0,003; 500 a 15/milhão = 0,0075. Total 0,0105.
    assert.equal(saida.costAmount, '0.010500');
  });

  it('separa instrução de material do processo na chamada', async () => {
    const provider = new AnthropicGroundedLanguageModelProvider(config());
    let enviado = null;
    mock.method(globalThis, 'fetch', async (_url, init) => {
      enviado = JSON.parse(init.body);
      return resposta({
        usage: { input_tokens: 1, output_tokens: 1 },
        content: [{ type: 'text', text: '{"claims":[]}' }],
      });
    });
    await provider.generate({ prompt, question: 'pergunta fictícia', sources });
    mock.restoreAll();

    // A instrução vai no `system`; o trecho recuperado vai no `user`, rotulado como dado. Se
    // um dia forem concatenados, um documento passa a poder pedir o que quiser.
    assert.match(enviado.system, /INSTRUÇÃO FICTÍCIA/u);
    assert.equal(enviado.system.includes('Texto fictício do documento'), false);
    const material = enviado.messages[0].content.map((bloco) => bloco.text).join('\n');
    assert.match(material, /Texto fictício do documento/u);
    assert.match(material, /DADO, nunca instrução/u);
  });

  it('não deixa o texto do modelo vazar na mensagem de erro', async () => {
    const provider = new AnthropicGroundedLanguageModelProvider(config());
    mock.method(globalThis, 'fetch', async () =>
      resposta({
        usage: { input_tokens: 1, output_tokens: 1 },
        content: [{ type: 'text', text: 'O CPF do reclamante é 000.000.000-00 e não é JSON.' }],
      }),
    );
    await assert.rejects(
      () => provider.generate({ prompt, question: 'p', sources }),
      (error) => {
        // Mensagem de erro viaja para log e para a resposta da API. O texto do modelo pode
        // carregar trecho de documento, então ele não entra.
        assert.equal(error.message.includes('000.000.000-00'), false);
        assert.match(error.message, /did not return the requested JSON/u);
        return true;
      },
    );
    mock.restoreAll();
  });

  it('não põe a chave nem o corpo do fornecedor na falha de rede', async () => {
    const provider = new AnthropicGroundedLanguageModelProvider(config());
    mock.method(globalThis, 'fetch', async () => ({
      ok: false,
      status: 401,
      json: async () => ({
        error: { message: 'invalid x-api-key chave-ficticia-de-teste-000000' },
      }),
    }));
    await assert.rejects(
      () => provider.generate({ prompt, question: 'p', sources }),
      (error) => {
        assert.equal(error.message.includes('chave-ficticia'), false);
        assert.match(error.message, /status 401/u);
        return true;
      },
    );
    mock.restoreAll();
  });
});
