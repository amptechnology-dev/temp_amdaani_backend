import { ValidationError } from 'yup';
import { ApiError } from '../utils/responseHandler.js';

const validate = (schema) => async (req, res, next) => {
  const errors = [];

  // Loop through each schema part (body, query, params) and validate
  for (const [key, validator] of Object.entries(schema)) {
    if (validator) {
      try {
        req[key] = await validator.validate(req[key], { abortEarly: false, stripUnknown: true });
      } catch (err) {
        if (err instanceof ValidationError) {
          errors.push(
            ...err.inner.map((e) => ({
              source: key,
              field: e.path,
              message: e.message,
            }))
          );
        }
      }
    }
  }

  // If there are validation errors, pass them to the next error handler
  if (errors.length) {
    next(new ApiError(400, 'Validation Error', errors));
  }
  next();
};

export default validate;
