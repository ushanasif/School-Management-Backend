/**
 * AppError
 * ---------
 * Use this for all "expected"/operational errors thrown intentionally
 * from controllers or services (e.g. not found, unauthorized, bad input).
 *
 * Example:
 *   throw new AppError('User not found', 404);
 *   throw new AppError('Email already in use', 409, { field: 'email' });
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly status: 'fail' | 'error';
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, details?: unknown) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // marks this as a known, safe-to-expose error
    this.details = details;

    // Maintains proper stack trace (excludes constructor call from it)
    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, AppError.prototype);
  }

  // Handy static helpers (optional sugar)
  static badRequest(message = 'Bad Request', details?: unknown) {
    return new AppError(message, 400, details);
  }
  static unauthorized(message = 'Unauthorized', details?: unknown) {
    return new AppError(message, 401, details);
  }
  static forbidden(message = 'Forbidden', details?: unknown) {
    return new AppError(message, 403, details);
  }
  static notFound(message = 'Not Found', details?: unknown) {
    return new AppError(message, 404, details);
  }
  static conflict(message = 'Conflict', details?: unknown) {
    return new AppError(message, 409, details);
  }
}