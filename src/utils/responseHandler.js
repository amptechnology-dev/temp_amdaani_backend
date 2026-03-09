// For SuccessResponse
export class ApiResponse {
  constructor(statusCode, data, message = 'Success') {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
  }

  send(res) {
    return res.status(this.statusCode).json({
      success: this.success,
      message: this.message,
      data: this.data,
    });
  }
}

// For ErrorResponse
export class ApiError extends Error {
  constructor(statusCode, message = 'Something went wrong', errors = [], stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.message = message;
    this.success = false;
    this.errors = errors;
    this.data = null;
    this.isOperational = true;

    stack ? (this.stack = stack) : Error.captureStackTrace(this, this.constructor);
  }

  send(res) {
    return res.status(this.statusCode).json({
      success: false,
      message: this.message,
      errors: this.errors,
      data: this.data,
      stack: process.env.NODE_ENV === 'development' ? this.stack : null,
    });
  }
}
