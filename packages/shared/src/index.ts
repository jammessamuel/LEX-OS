const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

/**
 * Restringe um valor não confiável a uma string UUID v4 canônica.
 *
 * Usado nas fronteiras que recebem identificadores externos, como cursores e declarações
 * JWT. Validar o formato não autoriza o identificador: o escopo do tenant e as permissões
 * continuam obrigatórios.
 */
export function isUuidV4(value: unknown): value is string {
  return typeof value === 'string' && uuidV4Pattern.test(value);
}

export {
  assertEmbeddingBatch,
  chunkKnowledgeText,
  DeterministicMockEmbeddingProvider,
  deterministicEmbeddingDescriptor,
} from './knowledge.js';
export type {
  DeterministicKnowledgeChunk,
  EmbeddingDescriptor,
  EmbeddingProvider,
  KnowledgeSourceLocator,
} from './knowledge.js';

export { caseDossierObjectKey } from './case-export.js';
export { legalSpecialties, specialtyCodeFor, specialtyFor } from './legal-specialties.js';
export type { LegalCaseType, LegalSpecialty } from './legal-specialties.js';
export {
  caseStatusLabels,
  checklistItemStatusLabels,
  confidentialityLabels,
  labelFor,
  participantRoleLabels,
  participantSideLabels,
  priorityLabels,
  providerLabels,
} from './legal-vocabulary.js';
export { cnjSegmentName, isValidCnj, normalizeCnj, parseCnj } from './cnj.js';
export type { CnjParts } from './cnj.js';

export {
  isSilenceableNotification,
  silenceableNotifications,
  emailTemplates,
  RecordingEmailProvider,
  renderEmail,
} from './email.js';

export {
  decodeBase32,
  decryptSecret,
  encodeBase32,
  encryptSecret,
  newRecoveryCodes,
  newTotpSecret,
  totpCodeAt,
  totpStepAt,
  totpUri,
  verifyTotp,
} from './totp.js';
export type {
  EmailDeliveryResult,
  EmailMessage,
  EmailProvider,
  EmailRecipient,
  EmailTemplateId,
  SilenceableNotification,
  RenderedEmail,
} from './email.js';

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
