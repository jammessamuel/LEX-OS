let deterministicJobId;

beforeAll(async () => {
  ({ deterministicJobId } = await import('../dist/processing/deterministic-id.js'));
});

describe('deterministic child processing IDs', () => {
  it('is stable, stage-specific and UUID v4-shaped', () => {
    const parent = '33333333-3333-4333-8333-333333333333';
    const first = deterministicJobId(parent, 'OCR');

    expect(deterministicJobId(parent, 'OCR')).toBe(first);
    expect(deterministicJobId(parent, 'ENTITY_EXTRACTION')).not.toBe(first);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
  });
});
