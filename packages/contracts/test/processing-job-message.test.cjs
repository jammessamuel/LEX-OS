const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const JOB_ID = '10000000-0000-4000-8000-000000000001';
const ORGANIZATION_ID = '10000000-0000-4000-8000-000000000002';

describe('processing job message v1', () => {
  it('round-trips a minimal reference-only payload and maps supported queues', async () => {
    const contracts = await import('../dist/index.js');
    const message = contracts.createProcessingJobMessage({
      processingJobId: JOB_ID,
      organizationId: ORGANIZATION_ID,
      correlationId: 'request-123',
    });

    assert.deepEqual(contracts.parseProcessingJobMessage(message), message);
    assert.equal(contracts.queueNameForJobType('FILE_VALIDATION'), 'file-validation');
    assert.equal(contracts.queueNameForJobType('OCR'), 'ocr-processing');
    assert.equal(contracts.queueNameForJobType('EMBEDDING'), 'embedding-generation');
    assert.equal(contracts.queueNameForJobType('TIMELINE_GENERATION'), 'timeline-generation');
    assert.equal(contracts.queueNameForJobType('CHECKLIST_ANALYSIS'), 'checklist-analysis');
  });

  it('rejects unsupported versions, malformed IDs, unsafe identifiers, and rich payloads', async () => {
    const { parseProcessingJobMessage } = await import('../dist/index.js');
    const valid = {
      schemaVersion: 1,
      processingJobId: JOB_ID,
      organizationId: ORGANIZATION_ID,
      correlationId: 'request-123',
    };

    assert.throws(() => parseProcessingJobMessage({ ...valid, schemaVersion: 2 }), /version/iu);
    assert.throws(
      () => parseProcessingJobMessage({ ...valid, processingJobId: 'not-a-uuid' }),
      /job ID/iu,
    );
    assert.throws(
      () => parseProcessingJobMessage({ ...valid, correlationId: 'unsafe value' }),
      /correlation/iu,
    );
    assert.throws(
      () => parseProcessingJobMessage({ ...valid, documentText: 'prohibited' }),
      /unexpected fields/iu,
    );
  });
});
