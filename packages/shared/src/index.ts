const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

/**
 * Narrows an untrusted value to a canonical v4 UUID string.
 *
 * Used at every boundary that accepts an identifier it did not generate — decoded
 * pagination cursors and JWT claims among them. Validating the shape does not authorize
 * the identifier: tenant scoping and permission checks still apply.
 */
export function isUuidV4(value: unknown): value is string {
  return typeof value === 'string' && uuidV4Pattern.test(value);
}

export type StructuredLogLevel = 'debug' | 'error' | 'info' | 'warn';

export interface StructuredLogEntry {
  level: StructuredLogLevel;
  service: string;
  message: string;
  correlationId: string;
  requestId?: string;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface LogContext {
  correlationId: string;
  requestId?: string;
  userId?: string;
  organizationId?: string;
  sessionId?: string;
}

export interface StructuredLoggerOptions {
  service: string;
  level: StructuredLogLevel;
  defaultCorrelationId: string;
  contextProvider?: () => LogContext | undefined;
}

const sensitiveKeyPattern =
  /authorization|cookie|password|secret|signed.?url|token|cpf|cnpj|(^|_)rg($|_)/iu;
const credentialInUrlPattern = /([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/giu;
const bearerPattern = /bearer\s+[a-z0-9._~+/=-]+/giu;
const levelPriority: Readonly<Record<StructuredLogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function sanitizeString(value: string): string {
  return value
    .replace(credentialInUrlPattern, '$1[REDACTED]@')
    .replace(bearerPattern, 'Bearer [REDACTED]');
}

export function redactSensitiveData(value: unknown, key = ''): unknown {
  if (sensitiveKeyPattern.test(key)) {
    return '[REDACTED]';
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message),
    };
  }

  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  if (
    value === null ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'undefined'
  ) {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item));
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redactSensitiveData(entryValue, entryKey),
      ]),
    );
  }

  return String(value);
}

export function writeStructuredLog(entry: StructuredLogEntry): void {
  const record = {
    timestamp: new Date().toISOString(),
    level: entry.level,
    service: entry.service,
    message: sanitizeString(entry.message),
    correlation_id: entry.correlationId,
    ...(entry.requestId === undefined ? {} : { request_id: entry.requestId }),
    ...(entry.metadata === undefined ? {} : { metadata: redactSensitiveData(entry.metadata) }),
  };
  const line = `${JSON.stringify(record)}\n`;

  if (entry.level === 'error') {
    process.stderr.write(line);
    return;
  }

  process.stdout.write(line);
}

export class StructuredLogger {
  readonly #options: StructuredLoggerOptions;

  constructor(options: StructuredLoggerOptions) {
    this.#options = options;
  }

  log(message: unknown, ...optionalParameters: unknown[]): void {
    this.#write('info', message, optionalParameters);
  }

  error(message: unknown, ...optionalParameters: unknown[]): void {
    this.#write('error', message, optionalParameters);
  }

  warn(message: unknown, ...optionalParameters: unknown[]): void {
    this.#write('warn', message, optionalParameters);
  }

  debug(message: unknown, ...optionalParameters: unknown[]): void {
    this.#write('debug', message, optionalParameters);
  }

  verbose(message: unknown, ...optionalParameters: unknown[]): void {
    this.#write('debug', message, optionalParameters);
  }

  fatal(message: unknown, ...optionalParameters: unknown[]): void {
    this.#write('error', message, optionalParameters);
  }

  #write(level: StructuredLogLevel, message: unknown, optionalParameters: unknown[]): void {
    if (levelPriority[level] < levelPriority[this.#options.level]) {
      return;
    }

    const currentContext = this.#options.contextProvider?.();
    const logMessage = typeof message === 'string' ? message : 'structured_log_event';
    const metadata =
      typeof message === 'string' && optionalParameters.length === 0
        ? undefined
        : {
            ...(typeof message === 'string' ? {} : { details: message }),
            ...(optionalParameters.length === 0 ? {} : { parameters: optionalParameters }),
          };

    writeStructuredLog({
      level,
      service: this.#options.service,
      message: logMessage,
      correlationId: currentContext?.correlationId ?? this.#options.defaultCorrelationId,
      ...(currentContext?.requestId === undefined ? {} : { requestId: currentContext.requestId }),
      ...(metadata === undefined ? {} : { metadata }),
    });
  }
}
