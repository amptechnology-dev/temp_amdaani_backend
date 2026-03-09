import yup from 'yup';
import { isValidObjectId } from 'mongoose';

export const createCategorySchema = {
  body: yup.object().shape({
    name: yup
      .string()
      .required('Category name is required')
      .trim()
      .max(255, 'Category name must be at most 255 characters'),
    slug: yup.string().trim().max(255, 'Slug must be at most 255 characters'),
    gstRate: yup
      .number()
      .typeError('GST rate must be a number')
      .min(0, 'GST rate cannot be negative')
      .max(28, 'GST rate cannot be more than 28'),
    isActive: yup.boolean().default(true),
  }),
};

export const updateCategorySchema = {
  params: yup.object().shape({
    id: yup.string().required('Category ID is required').test('is-object-id', 'Invalid Category ID', isValidObjectId),
  }),
  body: yup
    .object()
    .shape({
      name: yup.string().trim().max(255, 'Category name must be at most 255 characters'),
      slug: yup.string().trim().max(255, 'Slug must be at most 255 characters'),
      gstRate: yup
        .number()
        .typeError('GST rate must be a number')
        .min(0, 'GST rate cannot be negative')
        .max(28, 'GST rate cannot be more than 100'),
      isActive: yup.boolean(),
    })
    .test('emty-body', 'At least one field must be updated', (v) => v && Object.keys(v).length > 0),
};
