/**
 * Erro com status HTTP e mensagem pensada para o cliente (`expose`). `code` é um identificador
 * estável que o front pode usar, por exemplo `EMAIL_NOT_VERIFIED`. `details` vai junto na
 * resposta quando o front precisa de dados para decidir (ex.: a lista de agendamentos afetados).
 *
 * É a única classe de erro de regra da API: services e controllers lançam `httpError(...)` e o
 * `errorHandler` traduz para a resposta.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly expose = true as const;
  readonly code?: string;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number,
    code?: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    if (code) this.code = code;
    if (details) this.details = details;
  }
}

export type HttpError = AppError;

export function httpError(
  message: string,
  statusCode: number,
  code?: string,
  details?: Record<string, unknown>,
): AppError {
  return new AppError(message, statusCode, code, details);
}
