const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

describe('Delivery 8 prompt specifications', () => {
  it('exports complete, distinct, versioned prompt records', async () => {
    const { checklistPromptV1, timelinePromptV1 } = await import('../dist/index.js');

    for (const prompt of [timelinePromptV1, checklistPromptV1]) {
      assert.ok(prompt.identifier);
      assert.ok(prompt.version);
      assert.ok(prompt.purpose);
      assert.ok(prompt.inputSchema);
      assert.ok(prompt.outputSchema);
      assert.ok(prompt.examples.length > 0);
      assert.ok(prompt.validationCriteria.length > 0);
    }
    assert.notEqual(timelinePromptV1.identifier, checklistPromptV1.identifier);
    assert.notEqual(timelinePromptV1.version, checklistPromptV1.version);
  });
});
