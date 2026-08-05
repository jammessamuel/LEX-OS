const assert = require('node:assert/strict');
const { describe, it, mock } = require('node:test');

describe('HealthController', () => {
  it('reports liveness without consulting dependencies', async () => {
    const { HealthController } = await import('../../dist/health/health.controller.js');
    const controller = new HealthController({ checkReadiness: mock.fn() });

    assert.deepEqual(controller.getLiveness(), { status: 'up' });
  });

  it('uses HTTP 503 when a bounded dependency probe is down', async () => {
    const { HealthController } = await import('../../dist/health/health.controller.js');
    const report = {
      status: 'down',
      dependencies: { postgresql: 'up', redis: 'down', minio: 'up' },
      checkedAt: '2026-08-05T00:00:00.000Z',
    };
    const status = mock.fn();
    const controller = new HealthController({
      checkReadiness: mock.fn(async () => report),
    });

    assert.deepEqual(await controller.getReadiness({ status }), report);
    assert.deepEqual(status.mock.calls[0].arguments, [503]);
  });
});

describe('HealthService', () => {
  it('returns a down report instead of throwing when dependencies are unavailable', async () => {
    const { HealthService } = await import('../../dist/health/health.service.js');
    const service = new HealthService(
      {
        environment: 'test',
        service: {
          apiPort: 3000,
          dependencyTimeoutMs: 100,
          logLevel: 'error',
          webOrigin: 'http://localhost:5173',
          workerReadyFile: '/tmp/lex-os-worker-test-ready',
        },
        database: {
          host: '127.0.0.1',
          port: 1,
          name: 'unavailable',
          user: 'unavailable',
          password: 'unavailable',
          ssl: false,
        },
        authentication: {
          accessTokenSecret: 'test-access-token-secret-with-at-least-32-characters',
          accessTokenTtlSeconds: 900,
          refreshTokenTtlSeconds: 2592000,
          loginAttemptLimit: 5,
          loginAttemptWindowSeconds: 900,
        },
        redis: { host: '127.0.0.1', port: 1, password: 'unavailable' },
        objectStorage: {
          endpoint: 'http://127.0.0.1:1',
          bucket: 'unavailable',
          accessKey: 'unavailable',
          secretKey: 'unavailable',
          region: 'us-east-1',
          useSsl: false,
        },
      },
      {
        client: {
          $queryRaw: () => Promise.reject(new Error('unavailable')),
        },
      },
    );

    const report = await service.checkReadiness();

    assert.equal(report.status, 'down');
    assert.deepEqual(report.dependencies, {
      postgresql: 'down',
      redis: 'down',
      minio: 'down',
    });
    assert.equal(Number.isNaN(Date.parse(report.checkedAt)), false);
  });
});
