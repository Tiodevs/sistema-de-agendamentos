// ARQ-09: erro único do cliente HTTP e a tradução de falha → mensagem para a pessoa.
// Sem `window` nem `fetch`: é o que os testes de apps/web/test exercitam.

export interface ApiErrorBody {
  message?: string;
  code?: string;
  errors?: Array<{ field: string; message: string }>;
  details?: Record<string, unknown>;
}

export class ApiError extends Error {
  /** Status HTTP; `0` quando a resposta nem chegou (sem rede ou tempo esgotado). */
  statusCode: number;
  status: 'error';
  code?: string;
  errors?: Array<{ field: string; message: string }>;
  details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    message: string,
    errors?: Array<{ field: string; message: string }>,
    code?: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.status = 'error';
    this.code = code;
    this.errors = errors;
    this.details = details;
  }
}

export const NETWORK_ERROR_CODE = 'NETWORK';
export const TIMEOUT_ERROR_CODE = 'TIMEOUT';

export const NETWORK_ERROR_MESSAGE =
  'Sem conexão com o servidor. Confira a internet e tente de novo.';
export const TIMEOUT_ERROR_MESSAGE = 'O servidor demorou para responder. Tente de novo.';
export const SERVER_ERROR_MESSAGE = 'Tivemos um problema no servidor. Tente de novo em instantes.';
export const INVALID_RESPONSE_MESSAGE = 'Resposta inválida do servidor';
/** No lugar do "Token inválido ou expirado" da API, que não diz o que a pessoa deve fazer. */
export const SESSION_EXPIRED_MESSAGE = 'Sua sessão expirou. Entre de novo para continuar.';
const REQUEST_ERROR_MESSAGE = 'Erro na requisição';

/** Texto que a API usa no 500 sem causa conhecida: não diz nada para quem está na tela. */
const API_INTERNAL_MESSAGE = 'Erro interno do servidor';

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Requisição cancelada por quem chamou (`AbortController`): não é erro para mostrar. */
export function isAbortError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

/**
 * Mensagem para a tela (toast, aviso do formulário). Erro da API, de rede e de tempo esgotado já
 * trazem texto pronto; qualquer outra coisa cai no `fallback` da tela.
 */
export function apiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.message) return error.message;
  return fallback;
}

/** Erros por campo (`errors` do 400 de validação) como `{ campo: mensagem }`, ou `null`. */
export function apiFieldErrors(error: unknown): Record<string, string> | null {
  if (!(error instanceof ApiError) || !error.errors?.length) return null;
  const fields: Record<string, string> = {};
  for (const item of error.errors) fields[item.field] = item.message;
  return fields;
}

/**
 * Resposta com status de erro → `ApiError`. Em 4xx vale a mensagem da API. Em 5xx só quando ela
 * diz algo útil (ex.: 503 "temporariamente indisponível"); sem corpo JSON ou com o texto genérico
 * do 500, entra a mensagem amigável.
 */
export function errorFromResponse(statusCode: number, body: ApiErrorBody | null): ApiError {
  const message = typeof body?.message === 'string' ? body.message.trim() : '';

  if (statusCode >= 500) {
    const useful = message && message !== API_INTERNAL_MESSAGE;
    return new ApiError(statusCode, useful ? message : SERVER_ERROR_MESSAGE, undefined, body?.code);
  }

  return new ApiError(
    statusCode,
    message || (body ? REQUEST_ERROR_MESSAGE : INVALID_RESPONSE_MESSAGE),
    body?.errors,
    body?.code,
    body?.details,
  );
}

/**
 * Falha antes de haver resposta (o `fetch` rejeitou). Cancelamento por quem chamou segue como
 * veio, para a tela ignorar; o resto vira `ApiError` com `statusCode: 0` e texto em português,
 * no lugar do "Failed to fetch" do navegador.
 */
export function errorFromFailure(
  error: unknown,
  context: { callerAborted: boolean; timedOut: boolean },
): unknown {
  if (context.callerAborted) return error;
  if (context.timedOut || (error as { name?: unknown } | null)?.name === 'TimeoutError') {
    return new ApiError(0, TIMEOUT_ERROR_MESSAGE, undefined, TIMEOUT_ERROR_CODE);
  }
  if (isAbortError(error)) return error;
  return new ApiError(0, NETWORK_ERROR_MESSAGE, undefined, NETWORK_ERROR_CODE);
}
