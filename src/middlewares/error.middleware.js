import mongoose from 'mongoose';
import logger from '../config/logger.js';
import { ApiError } from '../utils/responseHandler.js';

// Error Conversion Middleware
export const errorConverter = (err, req, res, next) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || (error instanceof mongoose.Error ? 400 : 500); // 400 for Bad Request, 500 for Internal Server Error
    const message = error.message || 'Something went wrong';
    error = new ApiError(statusCode, message, error.errors || [], err.stack);
  }
  next(error);
};

// Error Handling Middleware
export const errorHandler = (err, req, res, next) => {
  let { statusCode, message } = err;

  // For production, hide the stack trace for non-operational errors
  if (process.env.NODE_ENV === 'production' && !err.isOperational) {
    statusCode = 500; // Internal Server Error
    message = 'Internal Server Error';
  }

  // Log error details using Pino
  if (process.env.NODE_ENV === 'development' || !err.isOperational) {
    logger.error(
      {
        statusCode,
        errors: err.errors,
        route: req.originalUrl,
        method: req.method,
        stack: err.stack,
      },
      message
    );
  }

  // Send the error response
  return err.send(res);
};
