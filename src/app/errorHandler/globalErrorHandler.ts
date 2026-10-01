import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from './AppError';
import { Prisma } from '../../../generated/prisma/client';
import { uniqueFields } from '../utils/prismaError';


const isDev = process.env.NODE_ENV === 'development';

interface ErrorResponse {
  success: false;
  status: string;
  statusCode: number;
  message: string;
  errors?: unknown;
  stack?: string;
}

/* -------------------------------------------------------------------------- */
/*  Individual error transformers                                             */
/*  Each converts a specific error type into a normalized AppError            */
/* -------------------------------------------------------------------------- */

const handleZodError = (err: ZodError): AppError => {
  const issues = err.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));

  return new AppError('Validation failed', 400, issues);
};

const handlePrismaKnownError = (
  err: Prisma.PrismaClientKnownRequestError,
): AppError => {
  switch (err.code) {
    case 'P2002': {
      // Unique constraint violation (safety net: services catch the cases
      // that need a specific message)
      const fields = uniqueFields(err);
      return new AppError(
        fields.length
          ? `A record with the same ${fields.join(', ')} already exists.`
          : 'A record with the same value already exists.',
        409,
        fields.length ? { fields } : undefined,
      );
    }
    case 'P2003':
      // Foreign key constraint failed: insert with a bad reference, or a
      // delete/update blocked by a Restrict relation
      return new AppError(
        'This record is linked to other data and cannot be changed or removed.',
        409,
      );
    case 'P2025':
      // Record not found (update/delete on missing row)
      return new AppError(
        (err.meta?.cause as string) ?? 'Record not found',
        404,
      );
    case 'P2014':
      return new AppError('Invalid relation between records', 400);
    case 'P2034':
      // Write conflict / deadlock: safe for the client to retry
      return new AppError('The system is busy. Please try again.', 409);
    case 'P2028':
      // Interactive transaction timed out
      return new AppError('The request took too long. Please try again.', 503);
    default:
      return new AppError(`Database error (${err.code})`, 400);
  }
};

const handlePrismaValidationError = (
  _err: Prisma.PrismaClientValidationError,
): AppError => {
  return new AppError('Invalid data passed to database query', 400);
};

const handlePrismaInitError = (
  _err: Prisma.PrismaClientInitializationError,
): AppError => {
  return new AppError('Failed to connect to database', 500);
};

const handleJWTError = (): AppError =>
  new AppError('Invalid token. Please log in again.', 401);

const handleJWTExpiredError = (): AppError =>
  new AppError('Token expired. Please log in again.', 401);

/* -------------------------------------------------------------------------- */
/*  Response senders                                                          */
/* -------------------------------------------------------------------------- */

const sendDevError = (err: AppError, res: Response) => {
  const body: ErrorResponse = {
    success: false,
    status: err.status,
    statusCode: err.statusCode,
    message: err.message,
    errors: err.details,
    stack: err.stack,
  };
  res.status(err.statusCode).json(body);
};

const sendProdError = (err: AppError, res: Response) => {
  // Only leak details for errors we deliberately created (operational)
  if (err.isOperational) {
    const body: ErrorResponse = {
      success: false,
      status: err.status,
      statusCode: err.statusCode,
      message: err.message,
      errors: err.details,
    };
    return res.status(err.statusCode).json(body);
  }

  // Unknown/programming error: don't leak internals
  console.error('UNEXPECTED ERROR 💥', err);
  const body: ErrorResponse = {
    success: false,
    status: 'error',
    statusCode: 500,
    message: 'Something went wrong. Please try again later.',
  };
  res.status(500).json(body);
};

/* -------------------------------------------------------------------------- */
/*  Main handler                                                              */
/* -------------------------------------------------------------------------- */

export const globalErrorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
) => {
  console.log('error: ', err);
  let normalizedError: AppError;

  if (err instanceof AppError) {
    normalizedError = err;
  } else if (err instanceof ZodError) {
    normalizedError = handleZodError(err);
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    normalizedError = handlePrismaKnownError(err);
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    normalizedError = handlePrismaValidationError(err);
  } else if (err instanceof Prisma.PrismaClientInitializationError) {
    normalizedError = handlePrismaInitError(err);
  } else if (
    err instanceof Error &&
    (err as { type?: string }).type === 'entity.parse.failed'
  ) {
    // malformed JSON body (express.json)
    normalizedError = new AppError('Invalid JSON in request body', 400);
  } else if (
    err instanceof Error &&
    (err as { type?: string }).type === 'entity.too.large'
  ) {
    normalizedError = new AppError('Request body is too large', 413);
  } else if (err instanceof Error && err.name === 'JsonWebTokenError') {
    normalizedError = handleJWTError();
  } else if (err instanceof Error && err.name === 'TokenExpiredError') {
    normalizedError = handleJWTExpiredError();
  } else if (err instanceof Error) {
    // Unknown JS error -> wrap, mark non-operational so prod hides details
    normalizedError = new AppError(err.message || 'Internal Server Error', 500);
    (normalizedError as { isOperational: boolean }).isOperational = false;
  } else {
    // Something was thrown that isn't even an Error instance
    normalizedError = new AppError('Internal Server Error', 500);
    (normalizedError as { isOperational: boolean }).isOperational = false;
  }

  if (isDev) {
    sendDevError(normalizedError, res);
  } else {
    sendProdError(normalizedError, res);
  }
};

/**
 * 404 handler — mount AFTER all routes, BEFORE globalErrorHandler.
 *   app.use(notFoundHandler);
 *   app.use(globalErrorHandler);
 */
export const notFoundHandler = (req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));
};