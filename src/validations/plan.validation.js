import { isValidObjectId } from 'mongoose';
import yup from 'yup';

export const createPlan = {
  body: yup.object().shape({
    name: yup.string().trim().required('Plan name is required'),
    description: yup.string(),
    price: yup
      .number()
      .required('Price is required')
      .min(0, 'Price must be a positive number')
      .typeError('Price must be a number'),
    currency: yup.string().default('INR'),
    durationDays: yup
      .number()
      .required('Duration is required')
      .positive('Duration must be a positive number')
      .integer('Duration must be a whole number')
      .typeError('Duration must be a number'),
    usageLimits: yup.object().shape({
      invoices: yup
        .number()
        .nullable()
        .min(0, 'Invoice limit must be a non-negative number')
        .integer('Invoice limit must be a whole number'),
      unlimited: yup.boolean().default(false),
    }),
    features: yup.array().of(
      yup.object().shape({
        name: yup.string(),
        available: yup.boolean(),
        note: yup.string(),
      })
    ),
    isActive: yup.boolean().default(true),
  }),
};

export const updatePlan = {
  params: yup.object().shape({
    id: yup.string().required('Plan ID is required').test('is-object-id', 'Invalid Plan ID', isValidObjectId),
  }),
  body: yup.object().shape({
    name: yup.string().trim(),
    description: yup.string(),
    price: yup.number().min(0, 'Price must be a positive number').typeError('Price must be a number'),
    currency: yup.string().default('INR'),
    durationDays: yup
      .number()
      .positive('Duration must be a positive number')
      .integer('Duration must be a whole number')
      .typeError('Duration must be a number'),
    usageLimits: yup.object().shape({
      invoices: yup
        .number()
        .nullable()
        .min(0, 'Invoice limit must be a non-negative number')
        .integer('Invoice limit must be a whole number'),
      unlimited: yup.boolean().default(false),
    }),
    features: yup.array().of(
      yup.object().shape({
        name: yup.string(),
        available: yup.boolean(),
        note: yup.string(),
      })
    ),
    isActive: yup.boolean(),
  }),
};
