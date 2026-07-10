const logger = require('../utils/logger');

const createError = (message, statusCode = 400, code = 'BAD_REQUEST') => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
};

const errorHandler = (err, req, res, next) => {
  // Prisma-specific errors
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: 'A record with this value already exists',
      code: 'DUPLICATE_ENTRY',
      field: err.meta?.target,
    });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found', code: 'NOT_FOUND' });
  }
  if (err.code === 'P2003') {
    return res.status(400).json({ error: 'Related record not found', code: 'FOREIGN_KEY_VIOLATION' });
  }

  // Custom app errors
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';

  if (statusCode >= 500) {
    logger.error('Server error', { message: err.message, stack: err.stack, url: req.url, method: req.method });
  }

  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Internal server error' : err.message,
    code,
    ...(err.retryAfter ? { retryAfter: err.retryAfter } : {}),
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
};

module.exports = { errorHandler, createError };
