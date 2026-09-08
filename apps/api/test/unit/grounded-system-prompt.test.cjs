const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { describe, it } = require('node:test');

describe('procedência da instrução efetiva do assistente', () => {
  it('calcula o hash exatamente sobre a instrução renderizada', async () => {
    const { groundedSystemPrompt, groundedSystemPromptHash } =
      await import('../../dist/assistant/grounded-system-prompt.js');
    const prompt = { template: 'INSTRUÇÃO FICTÍCIA.', version: 'prompt-v1' };
    const sources = [{ chunkId: 'chunk-1', content: 'conteúdo que não pertence à instrução' }];

    const rendered = groundedSystemPrompt(prompt, sources);
    const expected = createHash('sha256').update(rendered, 'utf8').digest('hex');

    assert.equal(groundedSystemPromptHash(prompt, sources), expected);
    assert.match(expected, /^[a-f0-9]{64}$/u);
    assert.match(rendered, /chunk-1/u);
    assert.equal(rendered.includes(sources[0].content), false);
  });

  it('muda com a instrução efetiva, mas não com o conteúdo do documento', async () => {
    const { groundedSystemPromptHash } =
      await import('../../dist/assistant/grounded-system-prompt.js');
    const prompt = { template: 'INSTRUÇÃO FICTÍCIA.', version: 'prompt-v1' };
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
});
