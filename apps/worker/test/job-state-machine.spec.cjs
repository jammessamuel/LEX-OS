let assertTransition;
let canTransition;

beforeAll(async () => {
  ({ assertTransition, canTransition } = await import('../dist/processing/job-state-machine.js'));
});

describe('processing job state machine', () => {
  it.each([
    ['QUEUED', 'PROCESSING'],
    ['RETRYING', 'PROCESSING'],
    ['PROCESSING', 'COMPLETED'],
    ['PROCESSING', 'RETRYING'],
    ['PROCESSING', 'FAILED'],
    ['QUEUED', 'CANCELLED'],
    ['RETRYING', 'CANCELLED'],
    ['PROCESSING', 'CANCELLED'],
  ])('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  it.each([
    ['QUEUED', 'COMPLETED'],
    ['PROCESSING', 'PROCESSING'],
    ['COMPLETED', 'PROCESSING'],
    ['FAILED', 'RETRYING'],
    ['CANCELLED', 'QUEUED'],
  ])('rejects %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => assertTransition(from, to)).toThrow(/Invalid processing job transition/u);
  });
});
