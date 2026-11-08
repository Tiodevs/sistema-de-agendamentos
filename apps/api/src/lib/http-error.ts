export type HttpError = Error & { statusCode: number; expose: true; code?: string };

/**
 * Erro com status HTTP e mensagem pensada para o cliente (`expose`). `code` é um identificador
 * estável que o front pode usar, por exemplo `EMAIL_NOT_VERIFIED`.
 */
export function httpError(message: string, statusCode: number, code?: string): HttpError {
  const error = new Error(message) as HttpError;
  error.statusCode = statusCode;
  error.expose = true;
  if (code) error.code = code;
  return error;
}
