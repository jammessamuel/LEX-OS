import type { ApiErrorDetail, ApiErrorEnvelope } from './types.js';

const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '');

/**
 * Erro já traduzido para a interface.
 *
 * A API sempre responde no envelope documentado, com mensagem em pt-BR segura para exibir.
 * Quando a resposta não é um envelope — rede fora, proxy no caminho, HTML de erro — o
 * cliente sintetiza uma mensagem própria em vez de mostrar detalhe interno ao usuário.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: readonly ApiErrorDetail[];
  readonly requestId: string | null;

  constructor(envelope: {
    statusCode: number;
    code: string;
    message: string;
    details?: ApiErrorDetail[];
    requestId?: string | null;
  }) {
    super(envelope.message);
    this.name = 'ApiError';
    this.statusCode = envelope.statusCode;
    this.code = envelope.code;
    this.details = envelope.details ?? [];
    this.requestId = envelope.requestId ?? null;
  }

  /** Mensagem do primeiro erro de validação do campo, quando houver. */
  detailFor(field: string): string | undefined {
    return this.details.find((detail) => detail.field === field)?.message;
  }
}

const offlineError = () =>
  new ApiError({
    statusCode: 0,
    code: 'NETWORK_UNAVAILABLE',
    message: 'Não foi possível falar com o servidor. Verifique a conexão e tente novamente.',
  });

function isEnvelope(value: unknown): value is ApiErrorEnvelope {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as ApiErrorEnvelope).code === 'string' &&
    typeof (value as ApiErrorEnvelope).message === 'string'
  );
}

let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** Chamado quando a sessão não pode mais ser renovada, para a aplicação voltar ao login. */
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

/** Resposta 204 do contrato: sem corpo. */
export type NoContent = undefined;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Interno: evita laço infinito quando a própria renovação devolve 401. */
  skipRefresh?: boolean;
}

function buildUrl(path: string, query: RequestOptions['query']): string {
  const url = new URL(`${baseUrl}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function readEnvelope(response: Response): Promise<ApiError> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }

  if (isEnvelope(payload)) {
    return new ApiError({ ...payload, statusCode: payload.statusCode ?? response.status });
  }

  return new ApiError({
    statusCode: response.status,
    code: 'UNEXPECTED_RESPONSE',
    message: 'O servidor respondeu de forma inesperada. Tente novamente em instantes.',
  });
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, skipRefresh = false } = options;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(accessToken === null ? {} : { Authorization: `Bearer ${accessToken}` }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw offlineError();
  }

  // O token de acesso é curto por desenho. Uma renovação silenciosa evita expulsar quem
  // está no meio de uma revisão; se ela também falhar, a sessão acabou de verdade.
  if (response.status === 401 && !skipRefresh) {
    const renewed = await renewSession();
    if (renewed) {
      return request<T>(path, { ...options, skipRefresh: true });
    }
    onUnauthorized?.();
    throw await readEnvelope(response);
  }

  if (!response.ok) {
    throw await readEnvelope(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/**
 * Envio multipart. Separado de `request` porque aqui o corpo é FormData — o navegador
 * define o Content-Type com o boundary sozinho, e forçar um cabeçalho quebraria o parse.
 * O mesmo par renovação-silenciosa/401 se aplica.
 */
export async function upload<T>(
  path: string,
  files: readonly File[],
  options: { skipRefresh?: boolean } = {},
): Promise<T> {
  const body = new FormData();
  for (const file of files) {
    body.append('files', file, file.name);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, undefined), {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(accessToken === null ? {} : { Authorization: `Bearer ${accessToken}` }),
      },
      body,
    });
  } catch {
    throw offlineError();
  }

  if (response.status === 401 && options.skipRefresh !== true) {
    const renewed = await renewSession();
    if (renewed) {
      return upload<T>(path, files, { skipRefresh: true });
    }
    onUnauthorized?.();
    throw await readEnvelope(response);
  }

  if (!response.ok) {
    throw await readEnvelope(response);
  }

  return (await response.json()) as T;
}

let inFlightRenewal: Promise<boolean> | null = null;

/** Renova a sessão no máximo uma vez por vez, mesmo com várias requisições em paralelo. */
function renewSession(): Promise<boolean> {
  inFlightRenewal ??= (async () => {
    try {
      const renewed = await request<{ accessToken: string }>('/auth/refresh', {
        method: 'POST',
        skipRefresh: true,
      });
      setAccessToken(renewed.accessToken);
      return true;
    } catch {
      setAccessToken(null);
      return false;
    } finally {
      inFlightRenewal = null;
    }
  })();

  return inFlightRenewal;
}
