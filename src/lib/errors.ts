export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor({
    message,
    code,
    statusCode,
    details,
  }: {
    message: string;
    code: string;
    statusCode: number;
    details?: unknown;
  }) {
    super(message);
    this.name = 'AppError';
    this.message = message;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function badRequest(message: string, details?: unknown) {
  return new AppError({
    message,
    code: 'VALIDATION_ERROR',
    statusCode: 400,
    details,
  });
}

export function unauthorized(message = 'Authentication required') {
  return new AppError({
    message,
    code: 'UNAUTHORIZED',
    statusCode: 401,
  });
}

export function forbidden(message = 'You do not have permission to perform this action') {
  return new AppError({
    message,
    code: 'FORBIDDEN',
    statusCode: 403,
  });
}

export function notFound(message: string) {
  return new AppError({
    message,
    code: 'NOT_FOUND',
    statusCode: 404,
  });
}

export function conflict(message: string, details?: unknown) {
  return new AppError({
    message,
    code: 'CONFLICT',
    statusCode: 409,
    details,
  });
}

export function tooManyRequests(message = 'Too many requests') {
  return new AppError({
    message,
    code: 'RATE_LIMITED',
    statusCode: 429,
  });
}

export function internalServerError(message = 'An unexpected error occurred') {
  return new AppError({
    message,
    code: 'INTERNAL_SERVER_ERROR',
    statusCode: 500,
  });
}
