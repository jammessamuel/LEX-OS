const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

describe('Delivery 8 prompt specifications', () => {
  it('exports complete, distinct, versioned prompt records', async () => {
    const { checklistPromptV1, groundedAnswerPromptV1, timelinePromptV1 } =
      await import('../dist/index.js');

    for (const prompt of [timelinePromptV1, checklistPromptV1, groundedAnswerPromptV1]) {
      assert.ok(prompt.identifier);
      assert.ok(prompt.version);
      assert.ok(prompt.purpose);
      assert.ok(prompt.inputSchema);
      assert.ok(prompt.outputSchema);
      assert.ok(prompt.examples.length > 0);
      assert.ok(prompt.validationCriteria.length > 0);
      assert.ok(prompt.task);
      assert.ok(prompt.template);
      assert.ok(['DRAFT', 'REVIEWED'].includes(prompt.reviewStatus));
      assert.equal(prompt.specialty, null);
    }
    assert.notEqual(timelinePromptV1.identifier, checklistPromptV1.identifier);
    assert.notEqual(timelinePromptV1.version, checklistPromptV1.version);
    assert.notEqual(groundedAnswerPromptV1.identifier, checklistPromptV1.identifier);
  });
});
