import type { NextFunction, Request, RequestHandler, Response } from 'express';

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;

/**
 * No Express 4, uma promise rejeitada num handler não chega ao `errorHandler` (e derruba o
 * processo). Este wrapper encaminha a rejeição para o `next`, então o handler não precisa de
 * try/catch.
 */
export function asyncHandler(handler: Handler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve()
      .then(() => handler(req, res, next))
      .catch(next);
  };
}

type Wrapped<T> = {
  [K in keyof T]: T[K] extends (...args: never[]) => unknown ? RequestHandler : T[K];
};

/**
 * Embrulha todos os métodos de um controller com o `asyncHandler`. Erros de validação (ZodError),
 * de regra (`httpError`) e do Prisma lançados em qualquer método seguem para o `errorHandler`.
 */
export function asyncController<T extends object>(controller: T): Wrapped<T> {
  const wrapped: Record<string, unknown> = {};
  const proto = Object.getPrototypeOf(controller) as Record<string, unknown>;
  for (const name of Object.getOwnPropertyNames(proto)) {
    if (name === 'constructor') continue;
    const method = proto[name];
    if (typeof method !== 'function') continue;
    wrapped[name] = asyncHandler((req, res, next) =>
      (method as Handler).call(controller, req, res, next),
    );
  }
  return wrapped as Wrapped<T>;
}
