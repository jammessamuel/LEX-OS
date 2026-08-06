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
