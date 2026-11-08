export type HttpError = Error & {
  statusCode: number;
  expose: true;
  code?: string;
  details?: Record<string, unknown>;
};

/**
 * Erro com status HTTP e mensagem pensada para o cliente (`expose`). `code` é um identificador
 * estável que o front pode usar, por exemplo `EMAIL_NOT_VERIFIED`. `details` vai junto na
 * resposta quando o front precisa de dados para decidir (ex.: a lista de agendamentos afetados).
 */
export function httpError(
  message: string,
  statusCode: number,
  code?: string,
  details?: Record<string, unknown>,
): HttpError {
  const error = new Error(message) as HttpError;
  error.statusCode = statusCode;
  error.expose = true;
  if (code) error.code = code;
  if (details) error.details = details;
  return error;
}
