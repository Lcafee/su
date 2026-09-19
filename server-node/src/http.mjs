export class ApiError extends Error {
  constructor(status, type, message, details = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.type = type;
    this.details = details;
  }
}

export function requireAllowedOrigin(request, config) {
  const actual = request.headers.origin || '';
  if (actual !== config.allowedOrigin) {
    throw new ApiError(403, 'origin_rejected', 'The request origin is not allowed.');
  }
}

export function requireObjectBody(request) {
  const value = request.body;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'invalid_json', 'The JSON root must be an object.');
  }
  return value;
}

export function requiredText(value, field, maxLength) {
  if (typeof value !== 'string') {
    throw new ApiError(422, 'validation_error', `${field} must be text.`, { field });
  }
  const normalized = value.trim();
  if (normalized.length < 1 || [...normalized].length > maxLength) {
    throw new ApiError(
      422,
      'validation_error',
      `${field} must contain between 1 and ${maxLength} characters.`,
      { field },
    );
  }
  return normalized;
}

export function optionalText(value, field, maxLength) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || [...value].length > maxLength) {
    throw new ApiError(
      422,
      'validation_error',
      `${field} must be null or at most ${maxLength} characters.`,
      { field },
    );
  }
  return value.trim();
}

export function booleanValue(value, field) {
  if (typeof value !== 'boolean') {
    throw new ApiError(422, 'validation_error', `${field} must be boolean.`, { field });
  }
  return value;
}

export function installApiErrorHandler(app) {
  app.setErrorHandler(async (error, request, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    reply.header('Pragma', 'no-cache');
    reply.header('X-Content-Type-Options', 'nosniff');

    if (error instanceof ApiError) {
      reply.code(error.status);
      return {
        error: {
          type: error.type,
          message: error.message,
          details: error.details,
        },
      };
    }

    if (error?.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      reply.code(413);
      return {
        error: {
          type: 'payload_too_large',
          message: 'The request body is too large.',
          details: [],
        },
      };
    }

    if (error instanceof SyntaxError && request.headers['content-type']?.includes('application/json')) {
      reply.code(400);
      return {
        error: {
          type: 'invalid_json',
          message: 'The request body is not valid JSON.',
          details: [],
        },
      };
    }

    const requestId = request.id;
    request.log.error({ err: error, requestId }, 'admin request failed');
    reply.code(500);
    return {
      error: {
        type: 'internal_error',
        message: 'The request could not be completed.',
        requestId,
      },
    };
  });
}
