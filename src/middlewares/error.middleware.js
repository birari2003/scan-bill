const { UniqueConstraintError, ValidationError } = require('sequelize');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { sendError } = require('../utils/apiResponse');

const notFoundHandler = (req, _res, next) => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    return sendError(res, err.statusCode, err.code, err.message, err.details);
  }

  if (err instanceof UniqueConstraintError) {
    return sendError(res, 409, 'CONFLICT', 'A record with these details already exists');
  }

  if (err instanceof ValidationError) {
    const details = err.errors.map((e) => ({ field: e.path, message: e.message }));
    return sendError(res, 422, 'VALIDATION_ERROR', details[0]?.message || 'Validation failed', details);
  }

  if (err.type === 'entity.parse.failed') {
    return sendError(res, 400, 'BAD_REQUEST', 'Malformed JSON body');
  }

  console.error(err);
  return sendError(
    res,
    500,
    'INTERNAL_ERROR',
    env.isProduction ? 'Something went wrong' : err.message || 'Something went wrong'
  );
};

module.exports = { notFoundHandler, errorHandler };
