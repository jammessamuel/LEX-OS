import {
  defineRailway,
  github,
  image,
  preserve,
  project,
  redis,
  service,
  volume,
  type VariableValue,
} from 'railway/iac';

const REGION = 'europe-west4-drams3a';
const DOCKERFILE_PATH = 'infra/docker/Dockerfile';

/**
 * De onde o código dos serviços de aplicação vem.
 *
 * Antes disto não havia origem declarada, e a implantação era upload do diretório local por
 * `railway up`. Isso tem dois problemas. O primeiro é operacional: em 2026-09-06 um `railway up`
 * sem serviço vinculado não falhou — criou um projeto novo com o nome da pasta e começou a
 * construir nele. O segundo é de garantia: o que subia era a árvore da máquina de quem rodou o
 * comando, que pode ter alteração não commitada, e não o que está no repositório.
 *
 * Com a origem no repositório, a implantação passa a ser o que `main` contém.
 *
 * `checkSuites` fecha a trava que falta: com ela o Railway espera as verificações do GitHub
 * concluírem antes de construir, e uma esteira vermelha deixa de virar implantação.
 *
 * **Ela ainda não está valendo, e é importante não confundir.** A origem foi conectada em
 * 2026-09-07 por `railway service source connect`, porque a CLI instalada é 5.40.1 e este arquivo
 * exige 5.42.1 ou mais — `railway config plan` recusa antes de ler qualquer coisa. Aquele comando
 * não expõe `checkSuites`, então o gatilho hoje dispara no push e não ao fim do CI. Esta linha
 * descreve o estado pretendido e passa a valer quando alguém atualizar a CLI e rodar
 * `railway config apply`. Até lá, esteira vermelha implanta.
 */
const REPOSITORIO = 'jammessamuel/LEX-OS';

function origemDoRepositorio() {
  return github(REPOSITORIO, { branch: 'main', checkSuites: true });
}

const APPLICATION_VARIABLES = [
  'AI_INPUT_COST_PER_MILLION_TOKENS',
  'AI_LANGUAGE_MODEL_API_KEY',
  'AI_LANGUAGE_MODEL_NAME',
  'AI_LANGUAGE_MODEL_PROVIDER',
  'AI_OUTPUT_COST_PER_MILLION_TOKENS',
  'API_PORT',
  'AUTH_ACCESS_TOKEN_SECRET',
  'AUTH_ACCESS_TOKEN_TTL_SECONDS',
  'AUTH_LOGIN_ATTEMPT_LIMIT',
  'AUTH_LOGIN_ATTEMPT_WINDOW_SECONDS',
  'AUTH_REFRESH_TOKEN_TTL_SECONDS',
  'CASE_ARCHIVE',
  'DATABASE_HOST',
  'DATABASE_NAME',
  'DATABASE_PASSWORD',
  'DATABASE_PORT',
  'DATABASE_SSL',
  'DATABASE_URL',
  'DATABASE_USER',
  'DEPENDENCY_TIMEOUT_MS',
  'FILE_INTAKE_ALLOWED_MIME_TYPES',
  'FILE_INTAKE_MAX_FILES_PER_REQUEST',
  'FILE_INTAKE_MAX_FILE_BYTES',
  'LOG_LEVEL',
  'MAIL_FROM',
  'MAIL_HOST',
  'MAIL_PORT',
  'NODE_ENV',
  'OBJECT_STORAGE_ACCESS_KEY',
  'OBJECT_STORAGE_BUCKET',
  'OBJECT_STORAGE_DOWNLOAD_URL_TTL_SECONDS',
  'OBJECT_STORAGE_ENDPOINT',
  'OBJECT_STORAGE_PUBLIC_ENDPOINT',
  'OBJECT_STORAGE_QUARANTINE_STALE_AFTER_SECONDS',
  'OBJECT_STORAGE_REGION',
  'OBJECT_STORAGE_SECRET_KEY',
  'OBJECT_STORAGE_USE_SSL',
  'PROCESSING_JOB_ATTEMPTS',
  'PROCESSING_JOB_BACKOFF_MS',
  'PROCESSING_QUEUE_PREFIX',
  'PROCESSING_RECONCILE_INTERVAL_SECONDS',
  'PROCESSING_STALE_AFTER_SECONDS',
  'PROCESSING_WORKER_CONCURRENCY',
  'REDIS_HOST',
  'REDIS_PASSWORD',
  'REDIS_PORT',
  'SECOND_FACTOR_ENCRYPTION_KEY',
  'WEB_ORIGIN',
  'WORKER_READY_FILE',
] as const;

function preservedVariables(names: readonly string[]): Record<string, VariableValue> {
  return Object.fromEntries(names.map((name) => [name, preserve()]));
}

function applicationBuild() {
  return {
    builder: 'DOCKERFILE' as const,
    dockerfilePath: DOCKERFILE_PATH,
  };
}

function persistentVolume() {
  return {
    alerts: { usage: { '80': {}, '95': {}, '100': {} } },
    allowOnlineResize: true,
    region: REGION,
    sizeMB: 5_000,
  };
}

export default defineRailway((context) => {
  const isStaging = context.isEnvironment('staging');
  const isProduction = context.isEnvironment('production');

  if (!isStaging && !isProduction) {
    throw new Error('Railway IaC is restricted to the staging and production environments.');
  }

  const redisVolume = volume('redis-volume', persistentVolume());
  const postgresVolume = volume('postgres-volume', persistentVolume());
  const minioVolume = volume('minio-volume', persistentVolume());

  const redisService = redis('Redis', { region: REGION });
  redisService.deploy = {
    startCommand:
      '/bin/sh -c "rm -rf $RAILWAY_VOLUME_MOUNT_PATH/lost+found/ && exec docker-entrypoint.sh redis-server --requirepass $REDIS_PASSWORD --save 60 1 --dir $RAILWAY_VOLUME_MOUNT_PATH"',
  };

  const api = service('api', {
    source: origemDoRepositorio(),
    build: applicationBuild(),
    deploy: {
      startCommand: 'node apps/api/dist/main.js',
      preDeployCommand: ['pnpm db:migrate:deploy'],
      healthcheckPath: '/api/v1/health/ready',
      healthcheckTimeout: 300,
      restartPolicyMaxRetries: 5,
    },
    replicas: { [REGION]: 1 },
    env: preservedVariables([...APPLICATION_VARIABLES, 'PORT', 'SEED_ADMIN_PASSWORD']),
  });

  const worker = service('worker', {
    source: origemDoRepositorio(),
    build: applicationBuild(),
    deploy: {
      startCommand: 'node apps/worker/dist/main.js',
      restartPolicyMaxRetries: 5,
    },
    replicas: { [REGION]: 1 },
    env: preservedVariables(APPLICATION_VARIABLES),
  });

  const web = isStaging
    ? service('web', {
        build: applicationBuild(),
        deploy: {
          startCommand:
            "sh -c 'pnpm --filter @lex-os/web preview --host 0.0.0.0 --port ${PORT:-5173}'",
          healthcheckPath: '/',
          healthcheckTimeout: 300,
          restartPolicyMaxRetries: 5,
        },
        replicas: { [REGION]: 1 },
        env: preservedVariables(['VITE_API_BASE_URL']),
      })
    : null;

  const postgres = service('postgres', {
    source: image('pgvector/pgvector:0.8.2-pg18-bookworm'),
    replicas: { [REGION]: 1 },
    volumeMounts: { '/var/lib/postgresql': postgresVolume },
    env: preservedVariables(['POSTGRES_DB', 'POSTGRES_PASSWORD', 'POSTGRES_USER']),
  });

  const minio = service('minio', {
    ...(isStaging
      ? {
          source: image('minio/minio:RELEASE.2025-04-22T22-12-26Z'),
          start: 'minio server /data --console-address :9001',
        }
      : {}),
    replicas: { [REGION]: 1 },
    volumeMounts: { '/data': minioVolume },
    env: preservedVariables(['MINIO_REGION_NAME', 'MINIO_ROOT_PASSWORD', 'MINIO_ROOT_USER']),
  });

  return project('lex-os', {
    resources: [
      api,
      ...(web ? [web] : []),
      redisService,
      postgres,
      worker,
      minio,
      redisVolume,
      postgresVolume,
      minioVolume,
    ],
  });
});
