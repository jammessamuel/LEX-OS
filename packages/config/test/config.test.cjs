const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { loadRuntimeConfig } = require('../dist/index.js');

function validEnvironment(overrides = {}) {
  return {
    API_PORT: '3000',
    AUTH_ACCESS_TOKEN_SECRET: 'test-access-token-secret-with-at-least-32-characters',
    AUTH_ACCESS_TOKEN_TTL_SECONDS: '900',
    AUTH_LOGIN_ATTEMPT_LIMIT: '5',
    AUTH_LOGIN_ATTEMPT_WINDOW_SECONDS: '900',
    AUTH_REFRESH_TOKEN_TTL_SECONDS: '2592000',
    DATABASE_HOST: '127.0.0.1',
    DATABASE_NAME: 'postgres',
    DATABASE_PASSWORD: 'local-password',
    DATABASE_PORT: '5432',
    DATABASE_SSL: 'false',
    DATABASE_USER: 'postgres',
    DEPENDENCY_TIMEOUT_MS: '2000',
    FILE_INTAKE_ALLOWED_MIME_TYPES: 'application/pdf,image/jpeg,image/png,text/plain',
    MAIL_HOST: '127.0.0.1',
    SECOND_FACTOR_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
    MAIL_PORT: '1025',
    MAIL_FROM: 'nao-responda@lexos.invalid',
    FILE_INTAKE_MAX_FILE_BYTES: '26214400',
    FILE_INTAKE_MAX_FILES_PER_REQUEST: '10',
    AI_INPUT_COST_PER_MILLION_TOKENS: '0',
    AI_LANGUAGE_MODEL_NAME: 'deterministic-grounded-v1',
    AI_LANGUAGE_MODEL_PROVIDER: 'mock',
    AI_OUTPUT_COST_PER_MILLION_TOKENS: '0',
    CASE_ARCHIVE: 'fictional',
    LOG_LEVEL: 'info',
    NODE_ENV: 'development',
    OBJECT_STORAGE_ACCESS_KEY: 'local-access-key',
    OBJECT_STORAGE_BUCKET: 'lex-os-private',
    OBJECT_STORAGE_ENDPOINT: 'http://127.0.0.1:9000',
    OBJECT_STORAGE_PUBLIC_ENDPOINT: 'http://127.0.0.1:9000',
    OBJECT_STORAGE_DOWNLOAD_URL_TTL_SECONDS: '60',
    OBJECT_STORAGE_QUARANTINE_STALE_AFTER_SECONDS: '3600',
    OBJECT_STORAGE_REGION: 'us-east-1',
    OBJECT_STORAGE_SECRET_KEY: 'local-secret-key',
    OBJECT_STORAGE_USE_SSL: 'false',
    PROCESSING_JOB_ATTEMPTS: '3',
    PROCESSING_JOB_BACKOFF_MS: '250',
    PROCESSING_QUEUE_PREFIX: 'lex-os-test',
    PROCESSING_RECONCILE_INTERVAL_SECONDS: '30',
    PROCESSING_STALE_AFTER_SECONDS: '60',
    PROCESSING_WORKER_CONCURRENCY: '2',
    REDIS_HOST: '127.0.0.1',
    REDIS_PASSWORD: 'local-redis-password',
    REDIS_PORT: '6379',
    WORKER_READY_FILE: '/tmp/lex-os-worker-ready',
    WEB_ORIGIN: 'http://localhost:5173',
    ...overrides,
  };
}

describe('loadRuntimeConfig', () => {
  it('returns typed values for an explicit development environment', () => {
    const config = loadRuntimeConfig(validEnvironment());

    assert.equal(config.service.apiPort, 3000);
    assert.equal(config.database.port, 5432);
    assert.equal(config.database.ssl, false);
    assert.equal(config.objectStorage.useSsl, false);
    assert.equal(config.fileIntake.maxFileBytes, 26_214_400);
    assert.equal(config.processing.jobAttempts, 3);
    assert.equal(config.processing.workerConcurrency, 2);
    assert.deepEqual(config.fileIntake.allowedMimeTypes, [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'text/plain',
    ]);
  });

  it('refuses the sample second-factor key in production', () => {
    // A chave chega em base64: o espaço reservado só aparece depois de decodificar, e um
    // guarda que olhasse apenas a string crua deixaria a chave de exemplo ir para produção.
    const environment = validEnvironment({
      NODE_ENV: 'production',
      // O restante precisa estar apto a produção para a falha ser a da chave, e não a do
      // primeiro segredo que o guarda encontrar.
      DATABASE_PASSWORD: 'uma-senha-de-producao-suficientemente-longa',
      AUTH_ACCESS_TOKEN_SECRET: 'um-segredo-de-producao-com-mais-de-32-caracteres',
      REDIS_PASSWORD: 'uma-senha-de-redis-de-producao',
      OBJECT_STORAGE_ACCESS_KEY: 'uma-chave-de-acesso-de-producao',
      OBJECT_STORAGE_SECRET_KEY: 'uma-chave-secreta-de-producao',
      SEED_ADMIN_PASSWORD: 'uma-senha-de-seed-de-producao',
      WORKER_READY_FILE: '/var/run/lex-os/worker-ready',
      SECOND_FACTOR_ENCRYPTION_KEY: Buffer.from('replace-with-a-local-32-byte-key').toString(
        'base64',
      ),
    });

    assert.throws(() => loadRuntimeConfig(environment), /SECOND_FACTOR_ENCRYPTION_KEY/u);
  });

  it('requires a 32-byte second-factor key, because AES-256 accepts no other size', () => {
    const environment = validEnvironment({
      SECOND_FACTOR_ENCRYPTION_KEY: Buffer.alloc(16, 1).toString('base64'),
    });

    assert.throws(() => loadRuntimeConfig(environment), /exactly 32 bytes/u);
  });

  it('requires an outgoing mail server and a declared sender', () => {
    // Nenhum e-mail sai sem remetente declarado, e a ausência aparece na inicialização em
    // vez de virar uma mensagem recusada pelo servidor depois.
    for (const missing of ['MAIL_HOST', 'MAIL_PORT', 'MAIL_FROM']) {
      // Sobrescrever com vazio equivale a ausente para o leitor de configuração, e evita
      // apagar chave calculada, que o lint recusa com razão.
      const env = validEnvironment({ [missing]: '' });
      assert.throws(() => loadRuntimeConfig(env), new RegExp(missing, 'u'));
    }
  });

  it('uses the managed-platform port when PORT is provided', () => {
    const environment = validEnvironment({ PORT: '4321' });
    delete environment.API_PORT;

    const config = loadRuntimeConfig(environment);

    assert.equal(config.service.apiPort, 4321);
  });

  it('falls back to API_PORT when PORT is absent or blank', () => {
    const config = loadRuntimeConfig(validEnvironment({ PORT: '   ' }));

    assert.equal(config.service.apiPort, 3000);
  });

  it('rejects an invalid managed-platform port instead of silently falling back', () => {
    assert.throws(
      () => loadRuntimeConfig(validEnvironment({ PORT: 'not-a-port' })),
      /PORT must be an integer between 1 and 65535/u,
    );
  });

  it('fails when a required value is absent', () => {
    const environment = validEnvironment();
    delete environment.DATABASE_HOST;

    assert.throws(() => loadRuntimeConfig(environment), /DATABASE_HOST is required/u);
  });

  it('rejects development placeholders in production', () => {
    const environment = validEnvironment({
      DATABASE_PASSWORD: '1234',
      NODE_ENV: 'production',
      WORKER_READY_FILE: '/var/run/lex-os/worker-ready',
    });

    assert.throws(
      () => loadRuntimeConfig(environment),
      /DATABASE_PASSWORD must be replaced with a strong production secret/u,
    );
  });

  it('rejects a weak access-token secret in production', () => {
    const environment = validEnvironment({
      AUTH_ACCESS_TOKEN_SECRET: 'jwt-secret-8fK2mQ7v4xP9cL6n',
      DATABASE_PASSWORD: 'db-secret-8fK2mQ7v',
      NODE_ENV: 'production',
      OBJECT_STORAGE_ACCESS_KEY: 'strong-storage-access-key',
      OBJECT_STORAGE_SECRET_KEY: 'strong-storage-secret-key',
      REDIS_PASSWORD: 'redis-secret-9xT4pL6n',
      WORKER_READY_FILE: '/var/run/lex-os/worker-ready',
    });

    assert.throws(
      () => loadRuntimeConfig(environment),
      /AUTH_ACCESS_TOKEN_SECRET must be replaced with a strong production secret/u,
    );
  });
});
