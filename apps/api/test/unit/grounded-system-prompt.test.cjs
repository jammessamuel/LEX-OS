const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { describe, it } = require('node:test');

// O contrato real da biblioteca, e não uma cópia: se a forma do GROUNDED_OUTPUT mudar, estes
// testes têm que sentir — é a mesma razão pela qual o schema do fio é derivado dele.
const { promptFor } = require('@lex-os/ai-prompts');

const promptReal = () => promptFor('GROUNDED_ANSWER', 'TRABALHISTA', { caseArchive: 'fictional' });

describe('procedência da instrução efetiva do assistente', () => {
  it('calcula o hash sobre a instrução renderizada MAIS o schema do fio', async () => {
    const { groundedSystemPrompt, groundedSystemPromptHash, groundedWireSchema } =
      await import('../../dist/assistant/grounded-system-prompt.js');
    const prompt = promptReal();
    const sources = [{ chunkId: 'chunk-1', content: 'conteúdo que não pertence à instrução' }];

    // O schema restringe a geração tanto quanto o texto; um hash que o ignorasse deixaria uma
    // mudança de contrato invisível na procedência. E é JSON.stringify simples de propósito:
    // os bytes hasheados são os bytes que o corpo da requisição envia.
    const rendered = groundedSystemPrompt(prompt, sources);
    const expected = createHash('sha256')
      .update(`${rendered}\n\n${JSON.stringify(groundedWireSchema(prompt))}`, 'utf8')
      .digest('hex');

    assert.equal(groundedSystemPromptHash(prompt, sources), expected);
    assert.match(expected, /^[a-f0-9]{64}$/u);
    assert.match(rendered, /chunk-1/u);
    assert.equal(rendered.includes(sources[0].content), false);
  });

  it('muda com a instrução efetiva, mas não com o conteúdo do documento', async () => {
    const { groundedSystemPromptHash } =
      await import('../../dist/assistant/grounded-system-prompt.js');
    const prompt = promptReal();
    const baseline = groundedSystemPromptHash(prompt, [
      { chunkId: 'chunk-1', content: 'primeiro conteúdo' },
    ]);

    assert.equal(
      groundedSystemPromptHash(prompt, [{ chunkId: 'chunk-1', content: 'outro conteúdo' }]),
      baseline,
    );
    assert.notEqual(
      groundedSystemPromptHash({ ...prompt, template: 'INSTRUÇÃO ALTERADA.' }, [
        { chunkId: 'chunk-1', content: 'primeiro conteúdo' },
      ]),
      baseline,
    );
    assert.notEqual(
      groundedSystemPromptHash(prompt, [{ chunkId: 'chunk-2', content: 'primeiro conteúdo' }]),
      baseline,
    );
  });

  it('muda quando o contrato de saída muda, porque o schema agora governa a geração', async () => {
    const { groundedSystemPromptHash } =
      await import('../../dist/assistant/grounded-system-prompt.js');
    const prompt = promptReal();
    const sources = [{ chunkId: 'chunk-1', content: 'primeiro conteúdo' }];
    const baseline = groundedSystemPromptHash(prompt, sources);

    const contratoAlterado = JSON.parse(JSON.stringify(prompt.outputSchema));
    contratoAlterado.properties.claims.items.properties.justificativa = { type: 'string' };
    contratoAlterado.properties.claims.items.required.push('justificativa');

    assert.notEqual(
      groundedSystemPromptHash({ ...prompt, outputSchema: contratoAlterado }, sources),
      baseline,
    );
  });

  it('deriva o schema do fio do contrato, sem nenhuma palavra-chave que a API rejeita', async () => {
    const { groundedWireSchema } = await import('../../dist/assistant/grounded-system-prompt.js');
    const prompt = promptReal();
    const schema = groundedWireSchema(prompt);

    // A casca: só claims, e fechada. Os outros oito campos do contrato são procedência que o
    // adaptador constrói — um schema que os exigisse seria insatisfazível.
    assert.deepEqual(Object.keys(schema.properties), ['claims']);
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual(schema.required, ['claims']);

    // O miolo espelha o contrato: mesmas chaves e mesmos obrigatórios do item de claim.
    const itemDoContrato = prompt.outputSchema.properties.claims.items;
    const itemDoFio = schema.properties.claims.items;
    assert.deepEqual(
      Object.keys(itemDoFio.properties).sort(),
      Object.keys(itemDoContrato.properties).sort(),
    );
    assert.deepEqual([...itemDoFio.required].sort(), [...itemDoContrato.required].sort());

    // E nenhuma palavra-chave rejeitada sobrevive, em nenhuma profundidade — a API falha a
    // requisição INTEIRA com 400 se uma escapar.
    const rejeitadas = new Set([
      'maxItems',
      'maxLength',
      'minLength',
      'pattern',
      'minimum',
      'maximum',
      'multipleOf',
      'format',
    ]);
    const percorre = (no, caminho) => {
      if (Array.isArray(no)) {
        no.forEach((item, i) => percorre(item, `${caminho}[${i}]`));
        return;
      }
      if (no === null || typeof no !== 'object') return;
      for (const [chave, valor] of Object.entries(no)) {
        assert.equal(rejeitadas.has(chave), false, `${caminho}.${chave} seria 400 na API`);
        if (chave === 'minItems') {
          assert.ok(valor <= 1, `${caminho}.minItems=${valor} seria 400 na API`);
        }
        percorre(valor, `${caminho}.${chave}`);
      }
    };
    percorre(schema, 'schema');
  });

  it('falha alto quando o prompt não carrega contrato de claims', async () => {
    const { groundedWireSchema } = await import('../../dist/assistant/grounded-system-prompt.js');
    assert.throws(
      () => groundedWireSchema({ template: 'X', version: 'sem-contrato-v1' }),
      /no claims contract/u,
    );
  });
});
