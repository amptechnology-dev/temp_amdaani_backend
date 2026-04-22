import yup from 'yup';
import { isValidObjectId } from 'mongoose';

const statusEnum = ['active', 'inactive', 'deleted'];

export const createProductSchema = {
  body: yup.object().shape({
    name: yup
      .string()
      .required('Product name is required')
      .trim()
      .max(255, 'Product name must be at most 255 characters'),
    slug: yup.string().trim().max(255),
    category: yup
      .string()
      .trim()
      .transform((v) => (v.trim() == '' ? undefined : v)),
    brand: yup.string().trim().max(255),
    sku: yup.string().trim().max(100),
    hsn: yup.string().trim().max(50),
    unit: yup.string().trim().max(50),
    costPrice: yup.number().typeError('Cost price must be a number').min(0, 'Cost price cannot be negative'),
    sellingPrice: yup.number().typeError('Selling price must be a number').min(0, 'Selling price cannot be negative'),
    isTaxInclusive: yup.boolean().default(false),
    discountPrice: yup
      .number()
      .typeError('Discount price must be a number')
      .min(0, 'Discount price cannot be negative'),
    purchaseDiscount: yup
      .number()
      .typeError('Discount price must be a number')
      .min(0, 'Discount price cannot be negative'),
    gstRate: yup
      .number()
      .typeError('GST rate must be a number')
      .min(0, 'GST rate cannot be negative')
      .max(28, 'GST rate cannot be more than 100'),
    purchaseGstRate: yup
      .number()
      .typeError('GST rate must be a number')
      .min(0, 'GST rate cannot be negative')
      .max(28, 'GST rate cannot be more than 100'),
    weight: yup.number().typeError('Weight must be a number').min(0, 'Weight cannot be negative'),
    tags: yup.array().of(yup.string().trim().max(50)),
    status: yup.string().oneOf(statusEnum, 'Invalid status').default('active'),
  }),
};

export const updateProductSchema = {
  body: yup
    .object()
    .shape({
      name: yup.string().trim().max(255),
      slug: yup.string().trim().max(255),
      category: yup
        .string()
        .trim()
        .transform((v) => (v.trim() == '' ? undefined : v)),
      brand: yup.string().trim().max(255),
      sku: yup.string().trim().max(100),
      hsn: yup.string().trim().max(50),
      unit: yup.string().trim().max(50),
      costPrice: yup.number().typeError('Cost price must be a number').min(0, 'Cost price cannot be negative'),
      sellingPrice: yup.number().typeError('Selling price must be a number').min(0, 'Selling price cannot be negative'),
      isTaxInclusive: yup.boolean(),
      discountPrice: yup
        .number()
        .typeError('Discount price must be a number')
        .min(0, 'Discount price cannot be negative'),
      gstRate: yup
        .number()
        .typeError('GST rate must be a number')
        .min(0, 'GST rate cannot be negative')
        .max(28, 'GST rate cannot be more than 100'),
      weight: yup.number().typeError('Weight must be a number').min(0, 'Weight cannot be negative'),
      tags: yup.array().of(yup.string().trim().max(50)),
      status: yup.string().oneOf(statusEnum, 'Invalid status'),
    })
    .test('emty-body', 'At least one field must be updated', (v) => v && Object.keys(v).length > 0),
};

export const adjustStockSchema = {
  body: yup.object().shape({
    productId: yup
      .string()
      .test('isObjectId', 'Invalid product ID', (v) => isValidObjectId(v))
      .required('Product ID is required'),
    date: yup.date().required('Date is required'),
    quantity: yup
      .number()
      .typeError('Quantity must be a number')
      .notOneOf([0], 'Quantity cannot be zero')
      .required('Quantity is required'),
    rate: yup.number().typeError('Rate must be a number').required('Rate is required'),
    batchId: yup.string(),
    remarks: yup.string().trim().max(500),
  }),
};
