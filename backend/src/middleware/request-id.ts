/**
 * A per-request id, returned on every error and attached to every log line.
 *
 * A customer quoting one turns a vague support ticket into a grep.
 * See docs/OBSERVABILITY.md §2.
 */
import type { RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

export const requestId: RequestHandler = (req, res, next) => {
  req.id = (req.headers['x-request-id'] as string) || randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
};
