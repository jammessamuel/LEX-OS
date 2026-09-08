const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export interface SeedEnvironment {
  readonly SEED_REMOTE_DATABASE_TARGET?: string;
}

function databaseTarget(databaseUrl: URL): string {
  const databaseName = decodeURIComponent(databaseUrl.pathname).replace(/^\/+/, '');

  if (databaseName.length === 0) {
    throw new Error('DATABASE_URL must identify a database before the fictional seed can run.');
  }

  return `${databaseUrl.hostname.toLowerCase()}:${databaseUrl.port || '5432'}/${databaseName}`;
}

/**
 * Impede que o seed fictício altere um banco remoto por engano. A exceção remota exige o alvo
 * exato, sem credenciais, para que uma autorização antiga não valha para outro banco.
 */
export function assertFictionalSeedTarget(
  rawDatabaseUrl: string,
  environment: SeedEnvironment,
): void {
  let databaseUrl: URL;

  try {
    databaseUrl = new URL(rawDatabaseUrl);
  } catch {
    throw new Error(
      'DATABASE_URL must be a valid PostgreSQL URL before the fictional seed can run.',
    );
  }

  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
    throw new Error('DATABASE_URL must use the postgres or postgresql protocol.');
  }

  const target = databaseTarget(databaseUrl);
  if (LOCAL_DATABASE_HOSTS.has(databaseUrl.hostname.toLowerCase())) {
    return;
  }

  if (environment.SEED_REMOTE_DATABASE_TARGET?.trim() === target) {
    return;
  }

  throw new Error(
    'The fictional seed refuses remote databases. To authorize one isolated fictional target, ' +
      `set SEED_REMOTE_DATABASE_TARGET exactly to ${target}.`,
  );
}
