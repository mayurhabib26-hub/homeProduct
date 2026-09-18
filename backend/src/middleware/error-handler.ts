import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ApiError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { isProduction } from '../lib/env.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` },
    requestId: req.id,
  });
};

/**
 * The only place an error becomes a response.
 *
 * Known ApiErrors carry a customer-safe message. Anything else is a bug: it is
 * logged in full and returned as a generic 500, because a stack trace in a
 * response body is an information leak. See docs/SECURITY.md.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ApiError) {
    if (err.status >= 500) logger.error({ err, requestId: req.id }, err.message);
    else logger.warn({ code: err.code, requestId: req.id, path: req.path }, err.message);

    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
      requestId: req.id,
    });
    return;
  }

  logger.error({ err, requestId: req.id, path: req.path }, 'unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on our side. Please try again.',
      ...(isProduction ? {} : { debug: String(err) }),
    },
    requestId: req.id,
  });
};

/** Wraps an async handler so a rejected promise reaches the error handler. */
export const asyncRoute =
  <T extends RequestHandler>(fn: T): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
