import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

type Schemas = { body?: ZodType; query?: ZodType; params?: ZodType };

export type Validated<B = unknown, Q = unknown, P = unknown> = { body: B; query: Q; params: P };

/**
 * Valida `body`, `query` e `params` antes do controller. O resultado (já com os defaults e
 * transformações do schema) fica em `res.locals.validated`; um dado inválido vira `ZodError`,
 * que o `errorHandler` responde como 400 com a lista de campos.
 */
export function validate(schemas: Schemas) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const current = (res.locals.validated ?? {}) as Partial<Validated>;
      res.locals.validated = {
        ...current,
        ...(schemas.body && { body: schemas.body.parse(req.body) }),
        ...(schemas.query && { query: schemas.query.parse(req.query) }),
        ...(schemas.params && { params: schemas.params.parse(req.params) }),
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function validated<B = unknown, Q = unknown, P = unknown>(res: Response) {
  return res.locals.validated as Validated<B, Q, P>;
}
