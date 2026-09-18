/**
 * Errors the API is allowed to show a customer.
 *
 * `message` is customer-facing and safe to display; `code` is what the
 * frontend branches on. Anything not an ApiError becomes a generic 500 —
 * stack traces never reach a client. See docs/API.md §1.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const notFound = (message = 'Not found') => new ApiError(404, 'NOT_FOUND', message);
export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, 'BAD_REQUEST', message, details);
