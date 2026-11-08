import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { isEmployeeOverlapError } from '../lib/booking-slot';

type ErrorBody = {
  statusCode: number;
  message: string;
  code?: string;
  errors?: Array<{ field: string; message: string }>;
  details?: Record<string, unknown>;
};

function exposedDetails(err: unknown) {
  const details = (err as { details?: unknown } | null)?.details;
  return details && typeof details === 'object' && !Array.isArray(details)
    ? (details as Record<string, unknown>)
    : undefined;
}

const INTERNAL_MESSAGE = 'Erro interno do servidor';
const UNAVAILABLE_MESSAGE = 'Serviço temporariamente indisponível. Tente novamente em instantes.';

/** Códigos do Prisma para banco fora do ar, conexão perdida, timeout ou pool esgotado. */
const PRISMA_UNAVAILABLE_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024', 'P2037']);
const NETWORK_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
]);

function numericStatus(err: unknown) {
  if (!err || typeof err !== 'object') return undefined;
  const record = err as { statusCode?: unknown; status?: unknown };
  const value = record.statusCode ?? record.status;
  return typeof value === 'number' && value >= 400 && value <= 599 ? value : undefined;
}

function errorCode(err: unknown) {
  if (!err || typeof err !== 'object') return undefined;
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function zodIssues(error: ZodError) {
  return error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }));
}

/** Traduz qualquer erro para status e mensagem que podem ir para o cliente. Nunca devolve texto interno em 5xx. */
export function toErrorBody(err: unknown): ErrorBody {
  if (err instanceof ZodError) {
    return { statusCode: 400, message: 'Dados inválidos', errors: zodIssues(err) };
  }

  const type = (err as { type?: unknown } | null)?.type;
  if (type === 'entity.parse.failed') {
    return { statusCode: 400, message: 'JSON inválido no corpo da requisição' };
  }
  if (type === 'entity.too.large') {
    return { statusCode: 413, message: 'Corpo da requisição muito grande' };
  }

  const status = numericStatus(err);
  const exposed = (err as { expose?: unknown } | null)?.expose === true;
  if (status && exposed && err instanceof Error) {
    const code = errorCode(err);
    const details = status < 500 ? exposedDetails(err) : undefined;
    return {
      statusCode: status,
      message: err.message,
      ...(code && { code }),
      ...(details && { details }),
    };
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return { statusCode: 409, message: 'Já existe um registro com estes dados.' };
    }
    if (err.code === 'P2003') {
      return {
        statusCode: 409,
        message:
          'Este registro está ligado a outros dados (como agendamentos). Desative em vez de excluir.',
      };
    }
    if (err.code === 'P2025') {
      return { statusCode: 404, message: 'Registro não encontrado' };
    }
    if (PRISMA_UNAVAILABLE_CODES.has(err.code)) {
      return { statusCode: 503, message: UNAVAILABLE_MESSAGE };
    }
  }

  if (isEmployeeOverlapError(err)) {
    return { statusCode: 409, message: 'O funcionário já possui um agendamento neste horário' };
  }

  if (
    err instanceof Prisma.PrismaClientInitializationError ||
    NETWORK_ERROR_CODES.has(errorCode(err) ?? '')
  ) {
    return { statusCode: 503, message: UNAVAILABLE_MESSAGE };
  }

  // Erros 4xx montados à mão (sem `expose`) já trazem mensagem para o cliente.
  if (status && status < 500 && err instanceof Error && err.message) {
    return { statusCode: status, message: err.message };
  }

  return { statusCode: status && status >= 500 ? status : 500, message: INTERNAL_MESSAGE };
}

export const errorHandler = (err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    // Resposta já começou: o handler padrão do Express encerra a conexão.
    next(err);
    return;
  }

  const body = toErrorBody(err);
  const requestId = typeof res.locals.requestId === 'string' ? res.locals.requestId : undefined;
  const label = `[ERROR] ${requestId ?? '-'} ${req.method} ${req.originalUrl} → ${body.statusCode}`;

  if (body.statusCode >= 500) {
    console.error(label, err);
  } else {
    console.warn(`${label}: ${body.message}`);
  }

  res.status(body.statusCode).json({
    status: 'error',
    statusCode: body.statusCode,
    message: body.message,
    ...(body.code && { code: body.code }),
    ...(body.errors && { errors: body.errors }),
    ...(body.details && { details: body.details }),
    ...(body.statusCode >= 500 && requestId && { requestId }),
  });
};
