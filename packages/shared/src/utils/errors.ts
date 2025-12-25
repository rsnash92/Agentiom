/**
 * Custom Error Classes
 *
 * Typed errors for consistent error handling across the application.
 */

/**
 * Base error class for all Agentiom errors
 */
export class AgentiomError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AgentiomError';
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends AgentiomError {
  constructor(message: string, details?: unknown) {
    super('validation_error', message, 400, details);
    this.name = 'ValidationError';
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends AgentiomError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} not found: ${id}` : `${resource} not found`;
    super('not_found', message, 404, { resource, id });
    this.name = 'NotFoundError';
  }
}

/**
 * Unauthorized error (401)
 */
export class UnauthorizedError extends AgentiomError {
  constructor(message = 'Unauthorized') {
    super('unauthorized', message, 401);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Forbidden error (403)
 */
export class ForbiddenError extends AgentiomError {
  constructor(message = 'Forbidden') {
    super('forbidden', message, 403);
    this.name = 'ForbiddenError';
  }
}

/**
 * Conflict error (409)
 */
export class ConflictError extends AgentiomError {
  constructor(message: string, details?: unknown) {
    super('conflict', message, 409, details);
    this.name = 'ConflictError';
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends AgentiomError {
  constructor(retryAfter?: number) {
    super('rate_limit', 'Too many requests', 429, { retryAfter });
    this.name = 'RateLimitError';
  }
}

/**
 * Provider error (502)
 * Used when an external provider (Fly.io, etc.) returns an error
 */
export class ProviderError extends AgentiomError {
  constructor(provider: string, message: string, details?: unknown) {
    super('provider_error', `${provider}: ${message}`, 502, {
      provider,
      ...((details as object) || {}),
    });
    this.name = 'ProviderError';
  }
}

/**
 * Check if an error is an AgentiomError
 */
export function isAgentiomError(error: unknown): error is AgentiomError {
  return error instanceof AgentiomError;
}
