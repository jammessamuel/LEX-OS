import { fileURLToPath } from 'node:url';

export type RuntimeEnvironment = 'development' | 'production' | 'test';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * O que o acervo desta instalação guarda.
 *
 * Mede risco, e o nome do ambiente não mede: um laptop de desenvolvimento apontado para a base
 * de um cliente roda com `NODE_ENV=development`, e uma homologação com acervo real também. Quem
 * decide se um prompt em rascunho pode rodar é isto, não `environment`.
 *
 * Não tem valor padrão de propósito. Uma instalação sem `CASE_ARCHIVE` não sobe — e falhar na
 * partida é o único jeito de a omissão não passar despercebida.
 */
export type CaseArchive = 'fictional' | 'real';

/**
 * Quem responde as perguntas fundamentadas.
 *
 * `mock` é o determinístico que não faz chamada externa. `anthropic` fala com um modelo de
 * verdade — e, por decisão do ADR-012, só é aceito sobre acervo fictício enquanto não houver
 * cláusula assinada de que o fornecedor não treina com o conteúdo enviado. A validação disso
 * está no adaptador, que se recusa a existir na combinação proibida.
 */
export type LanguageModelProviderName = 'mock' | 'anthropic';

export interface RuntimeConfig {
  environment: RuntimeEnvironment;
  caseArchive: CaseArchive;
  languageModel: {
    provider: LanguageModelProviderName;
    /** Vazio quando o provedor é o mock. Nunca aparece em log, auditoria ou resposta. */
    apiKey: string;
    modelName: string;
    /**
     * Preço por milhão de tokens, **já na moeda do modelo de custo**.
     *
     * Fica em configuração e não em código porque preço muda sem aviso, e preço errado em
     * código vira teto de caso calculado sobre número inventado. Converter moeda também é do
     * operador: inventar uma taxa de câmbio aqui seria pior que pedir o valor convertido.
     */
    inputCostPerMillionTokens: string;
    outputCostPerMillionTokens: string;
  };
  service: {
    apiPort: number;
    dependencyTimeoutMs: number;
    logLevel: LogLevel;
    webOrigin: string;
    workerReadyFile: string;
  };
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    ssl: boolean;
  };
  authentication: {
    accessTokenSecret: string;
    accessTokenTtlSeconds: number;
    refreshTokenTtlSeconds: number;
    loginAttemptLimit: number;
    loginAttemptWindowSeconds: number;
  };
  redis: {
    host: string;
    port: number;
    password: string;
  };
  processing: {
    queuePrefix: string;
    jobAttempts: number;
    jobBackoffMs: number;
    workerConcurrency: number;
    staleAfterSeconds: number;
    reconcileIntervalSeconds: number;
  };
  objectStorage: {
    endpoint: string;
    publicEndpoint: string;
    bucket: string;
    accessKey: string;
    secretKey: string;
    region: string;
    useSsl: boolean;
    downloadUrlTtlSeconds: number;
    quarantineStaleAfterSeconds: number;
  };
  fileIntake: {
    maxFileBytes: number;
    maxFilesPerRequest: number;
    allowedMimeTypes: readonly string[];
  };
  secondFactor: {
    /**
     * Chave de 32 bytes que cifra o segredo do segundo fator em repouso.
     *
     * Vive fora do banco de propósito: guardá-la junto do que ela protege não protegeria
     * nada. Rotacioná-la exige reinscrever todo mundo, então ela não muda por acaso.
     */
    encryptionKey: Buffer;
  };
  mail: {
    /** Servidor SMTP de saída. Em desenvolvimento, o Mailpit do Compose. */
    host: string;
    port: number;
    /** Remetente das mensagens de identidade. Nenhum e-mail sai sem um remetente declarado. */
    from: string;
  };
}

const environments: readonly RuntimeEnvironment[] = ['development', 'production', 'test'];
const logLevels: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'];
const caseArchives: readonly CaseArchive[] = ['fictional', 'real'];
const languageModelProviders: readonly LanguageModelProviderName[] = ['mock', 'anthropic'];
const productionPlaceholders = [
  '1234',
  'change-me',
  'changeme',
  'development-only',
  'password',
  'replace-',
  'replace-me',
] as const;

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();

  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function oneOf<const T extends string>(
  env: NodeJS.ProcessEnv,
  name: string,
  allowedValues: readonly T[],
): T {
  const value = required(env, name);

  if (!allowedValues.some((allowedValue) => allowedValue === value)) {
    throw new Error(`${name} must be one of: ${allowedValues.join(', ')}.`);
  }

  return value as T;
}

/**
 * Decimal como texto, para não perder precisão em ponto flutuante.
 *
 * O modelo de custo trabalha com `Decimal` de seis casas; passar por `number` no caminho
 * introduziria erro que só aparece somado ao fim do mês.
 */
function decimalString(env: NodeJS.ProcessEnv, name: string): string {
  const value = required(env, name);
  if (!/^\d{1,9}(\.\d{1,6})?$/u.test(value)) {
    throw new Error(`${name} must be a decimal amount with at most six decimal places.`);
  }
  return value;
}

function integer(env: NodeJS.ProcessEnv, name: string, minimum: number, maximum: number): number {
  const rawValue = required(env, name);
  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }

  return value;
}

function preferredInteger(
  env: NodeJS.ProcessEnv,
  preferredName: string,
  fallbackName: string,
  minimum: number,
  maximum: number,
): number {
  const preferredValue = env[preferredName]?.trim();
  const selectedName =
    preferredValue === undefined || preferredValue.length === 0 ? fallbackName : preferredName;

  return integer(env, selectedName, minimum, maximum);
}

function boolean(env: NodeJS.ProcessEnv, name: string): boolean {
  const value = required(env, name);

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw new Error(`${name} must be either true or false.`);
}

/**
 * Chave simétrica em base64, conferida no arranque.
 *
 * Trinta e dois bytes exatos: AES-256 não aceita outro tamanho, e descobrir isso na primeira
 * inscrição de segundo fator seria descobrir tarde demais.
 */
function encryptionKey(env: NodeJS.ProcessEnv, name: string): Buffer {
  const decoded = Buffer.from(required(env, name), 'base64');

  if (decoded.length !== 32) {
    throw new Error(`${name} must decode to exactly 32 bytes from base64.`);
  }

  return decoded;
}

function absoluteUrl(env: NodeJS.ProcessEnv, name: string): string {
  const value = required(env, name);

  try {
    const url = new URL(value);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('unsupported protocol');
    }
  } catch {
    throw new Error(`${name} must be an absolute HTTP or HTTPS URL.`);
  }

  return value.replace(/\/$/u, '');
}

function commaSeparatedAllowlist(env: NodeJS.ProcessEnv, name: string): readonly string[] {
  const values = required(env, name)
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);

  if (values.length === 0 || new Set(values).size !== values.length) {
    throw new Error(
      `${name} must contain a non-empty comma-separated allowlist without duplicates.`,
    );
  }

  return values;
}

function assertProductionSecret(name: string, value: string, minimumLength = 12): void {
  const normalizedValue = value.toLowerCase();
  const hasPlaceholder = productionPlaceholders.some((placeholder) =>
    normalizedValue.includes(placeholder),
  );

  if (value.length < minimumLength || hasPlaceholder) {
    throw new Error(`${name} must be replaced with a strong production secret.`);
  }
}

function validateProduction(config: RuntimeConfig): void {
  if (config.environment !== 'production') {
    return;
  }

  assertProductionSecret('DATABASE_PASSWORD', config.database.password);
  // A chave do segundo fator chega em base64, entao o texto do espaço reservado só aparece
  // depois de decodificar — é ali que ela precisa ser conferida.
  assertProductionSecret(
    'SECOND_FACTOR_ENCRYPTION_KEY',
    config.secondFactor.encryptionKey.toString('utf8'),
  );
  assertProductionSecret('AUTH_ACCESS_TOKEN_SECRET', config.authentication.accessTokenSecret, 32);
  assertProductionSecret('REDIS_PASSWORD', config.redis.password);
  if (config.languageModel.provider !== 'mock') {
    assertProductionSecret('AI_LANGUAGE_MODEL_API_KEY', config.languageModel.apiKey, 20);
  }
  assertProductionSecret('OBJECT_STORAGE_ACCESS_KEY', config.objectStorage.accessKey);
  assertProductionSecret('OBJECT_STORAGE_SECRET_KEY', config.objectStorage.secretKey);
}

export function loadRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const config: RuntimeConfig = {
    environment: oneOf(env, 'NODE_ENV', environments),
    caseArchive: oneOf(env, 'CASE_ARCHIVE', caseArchives),
    languageModel: {
      provider: oneOf(env, 'AI_LANGUAGE_MODEL_PROVIDER', languageModelProviders),
      apiKey: env.AI_LANGUAGE_MODEL_API_KEY ?? '',
      modelName: required(env, 'AI_LANGUAGE_MODEL_NAME'),
      inputCostPerMillionTokens: decimalString(env, 'AI_INPUT_COST_PER_MILLION_TOKENS'),
      outputCostPerMillionTokens: decimalString(env, 'AI_OUTPUT_COST_PER_MILLION_TOKENS'),
    },
    service: {
      apiPort: preferredInteger(env, 'PORT', 'API_PORT', 1, 65_535),
      dependencyTimeoutMs: integer(env, 'DEPENDENCY_TIMEOUT_MS', 100, 30_000),
      logLevel: oneOf(env, 'LOG_LEVEL', logLevels),
      webOrigin: absoluteUrl(env, 'WEB_ORIGIN'),
      workerReadyFile: required(env, 'WORKER_READY_FILE'),
    },
    database: {
      host: required(env, 'DATABASE_HOST'),
      port: integer(env, 'DATABASE_PORT', 1, 65_535),
      name: required(env, 'DATABASE_NAME'),
      user: required(env, 'DATABASE_USER'),
      password: required(env, 'DATABASE_PASSWORD'),
      ssl: boolean(env, 'DATABASE_SSL'),
    },
    authentication: {
      accessTokenSecret: required(env, 'AUTH_ACCESS_TOKEN_SECRET'),
      accessTokenTtlSeconds: integer(env, 'AUTH_ACCESS_TOKEN_TTL_SECONDS', 60, 3_600),
      refreshTokenTtlSeconds: integer(env, 'AUTH_REFRESH_TOKEN_TTL_SECONDS', 3_600, 7_776_000),
      loginAttemptLimit: integer(env, 'AUTH_LOGIN_ATTEMPT_LIMIT', 2, 100),
      loginAttemptWindowSeconds: integer(env, 'AUTH_LOGIN_ATTEMPT_WINDOW_SECONDS', 60, 86_400),
    },
    redis: {
      host: required(env, 'REDIS_HOST'),
      port: integer(env, 'REDIS_PORT', 1, 65_535),
      password: required(env, 'REDIS_PASSWORD'),
    },
    processing: {
      queuePrefix: required(env, 'PROCESSING_QUEUE_PREFIX'),
      jobAttempts: integer(env, 'PROCESSING_JOB_ATTEMPTS', 1, 10),
      jobBackoffMs: integer(env, 'PROCESSING_JOB_BACKOFF_MS', 100, 60_000),
      workerConcurrency: integer(env, 'PROCESSING_WORKER_CONCURRENCY', 1, 32),
      staleAfterSeconds: integer(env, 'PROCESSING_STALE_AFTER_SECONDS', 5, 86_400),
      reconcileIntervalSeconds: integer(env, 'PROCESSING_RECONCILE_INTERVAL_SECONDS', 5, 3_600),
    },
    objectStorage: {
      endpoint: absoluteUrl(env, 'OBJECT_STORAGE_ENDPOINT'),
      publicEndpoint: absoluteUrl(env, 'OBJECT_STORAGE_PUBLIC_ENDPOINT'),
      bucket: required(env, 'OBJECT_STORAGE_BUCKET'),
      accessKey: required(env, 'OBJECT_STORAGE_ACCESS_KEY'),
      secretKey: required(env, 'OBJECT_STORAGE_SECRET_KEY'),
      region: required(env, 'OBJECT_STORAGE_REGION'),
      useSsl: boolean(env, 'OBJECT_STORAGE_USE_SSL'),
      downloadUrlTtlSeconds: integer(env, 'OBJECT_STORAGE_DOWNLOAD_URL_TTL_SECONDS', 15, 300),
      quarantineStaleAfterSeconds: integer(
        env,
        'OBJECT_STORAGE_QUARANTINE_STALE_AFTER_SECONDS',
        300,
        604_800,
      ),
    },
    fileIntake: {
      maxFileBytes: integer(env, 'FILE_INTAKE_MAX_FILE_BYTES', 1_024, 1_073_741_824),
      maxFilesPerRequest: integer(env, 'FILE_INTAKE_MAX_FILES_PER_REQUEST', 1, 100),
      allowedMimeTypes: commaSeparatedAllowlist(env, 'FILE_INTAKE_ALLOWED_MIME_TYPES'),
    },
    secondFactor: {
      encryptionKey: encryptionKey(env, 'SECOND_FACTOR_ENCRYPTION_KEY'),
    },
    mail: {
      host: required(env, 'MAIL_HOST'),
      port: integer(env, 'MAIL_PORT', 1, 65_535),
      from: required(env, 'MAIL_FROM'),
    },
  };

  validateProduction(config);

  return config;
}

export function loadEnvironmentFileIfPresent(filePath: string | URL): void {
  try {
    process.loadEnvFile(typeof filePath === 'string' ? filePath : fileURLToPath(filePath));
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      'code' in error &&
      typeof error.code === 'string' &&
      error.code === 'ENOENT'
    ) {
      return;
    }

    throw error;
  }
}
