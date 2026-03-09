import { ApiError } from './responseHandler.js';

export const handleDuplicateKeyError = (err, model) => {
  if (err.code === 11000) {
    const resourceName = model?.modelName || 'Resource';
    const field = Object.keys(err.keyValue)[Object.keys(err.keyValue).length - 1];
    const message = `${resourceName} with same ${field} already exists.`;
    throw new ApiError(400, 'Duplicate key', [{ source: 'body', field, message }]);
  }
  throw err;
};
