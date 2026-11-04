import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z, type ZodTypeAny } from 'zod';
import { HttpError, unauthorized } from '../lib/errors.ts';
import { env } from '../lib/env.ts';
import { getUser, verifyAccess, type User } from '../services/auth.ts';

declare module 'express-serve-static-core' {
  interface Request {
    user?: User;
  }
}

/** Parses bearer token when present. Never fails: public routes can personalize. */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) {
    try {
      const { sub } = verifyAccess(h.slice(7));
      const u = getUser(sub);
      if (u) req.user = u;
    } catch {
      /* ignore — treated as anonymous */
    }
  }
  next();
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return next(unauthorized('Sign in required'));
  const { sub } = verifyAccess(h.slice(7));
  const u = getUser(sub);
  if (!u) return next(unauthorized('Account no longer exists'));
  req.user = u;
  next();
};

export function validate<T extends ZodTypeAny>(schema: T, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const issue = result.error.issues[0];
      return next(new HttpError(400, `${issue.path.join('.') || source}: ${issue.message}`, 'validation'));
    }
    (req as any).validated = { ...((req as any).validated ?? {}), [source]: result.data };
    next();
  };
}

export const v = <T>(req: Request, source: 'body' | 'query' | 'params' = 'body'): T => (req as any).validated?.[source];

/** Wrap async handlers so rejections flow into the error handler. */
export const wrap =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: { code: 'bad_json', message: 'Malformed JSON body' } });
  }
  console.error('[unhandled]', err);
  res.status(500).json({ error: { code: 'internal', message: env.isProd ? 'Something went wrong' : String((err as Error)?.message ?? err) } });
};

export const schemas = {
  id: z.object({ id: z.string().min(1).max(64) }),
  pagination: z.object({ limit: z.coerce.number().int().min(1).max(100).default(30), offset: z.coerce.number().int().min(0).default(0) }),
};
