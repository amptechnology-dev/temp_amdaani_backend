import yup from 'yup';
import { isValidObjectId } from 'mongoose';
import { ORDER_STATUS } from '../config/constants.js';

const orderItemSchema = yup.object().shape({
  product: yup
    .string()
    .required('Product ID is required')
    .test('is-valid-product-id', 'Invalid Product ID', (v) => isValidObjectId(v)),

  name: yup.string().required('Item name is required'),

  hsn: yup.string().nullable(),

  unit: yup.string().nullable(),

  sellingPrice: yup
    .number()
    .required('Selling price is required')
    .min(0, 'Selling price must be greater than or equal to 0'),

  gstRate: yup.number().default(0).min(0),

  isTaxInclusive: yup.boolean().default(false),

  quantity: yup
    .number()
    .required('Quantity is required')
    .min(1, 'Quantity must be at least 1'),

  discount: yup.number().default(0).min(0),

  total: yup
    .number()
    .required('Total is required')
    .min(0),
});

export const createOrder = {
  body: yup.object().shape({
    customer: yup
      .string()
      .required('Customer is required')
      .test('is-valid-customer-id', 'Invalid Customer ID', (v) =>
        isValidObjectId(v)
      ),

    customerName: yup.string().trim().max(255),

    customerMobile: yup
      .string()
      .trim()
      .nullable()
      .test(
        'is-valid-mobile',
        'Customer mobile must be a valid 10-digit number',
        (value) => {
          if (!value) return true;
          return /^[0-9]{10}$/.test(value);
        }
      ),

    customerAddress: yup.string().trim().nullable(),

    customerGstNumber: yup.string().trim().uppercase().nullable(),

    orderNumber: yup
      .string()
      .required('Order number is required'),

    orderDate: yup
      .date()
      .default(() => new Date())
      .typeError('Order date must be a valid date'),

    items: yup
      .array()
      .of(orderItemSchema)
      .min(1, 'At least one item is required'),

    subTotal: yup
      .number()
      .required('Sub total is required')
      .min(0),

    gstTotal: yup.number().default(0).min(0),

    discountTotal: yup.number().default(0).min(0),

    roundOff: yup.number().default(0),

    grandTotal: yup
      .number()
      .required('Grand total is required')
      .min(0),

    transportName: yup.string().trim().nullable(),

    trackingId: yup.string().trim().nullable(),

    lorryNumber: yup.string().trim().nullable(),

    deliveryAddress: yup.string().trim().nullable(),

    remarks: yup.string().trim().nullable(),

    status: yup
      .string()
      .oneOf(ORDER_STATUS, 'Invalid order status')
      .default('pending'),
  }),
};

export const updateOrder = {
  params: yup.object().shape({
    id: yup
      .string()
      .required('Order ID is required')
      .test('is-valid-order-id', 'Invalid Order ID', (v) =>
        isValidObjectId(v)
      ),
  }),

  body: createOrder.body,
};

export const changeOrderStatus = {
  params: yup.object().shape({
    id: yup
      .string()
      .required('Order ID is required')
      .test('is-valid-order-id', 'Invalid Order ID', (v) =>
        isValidObjectId(v)
      ),
  }),

  body: yup.object().shape({
    status: yup
      .string()
      .required('Status is required')
      .oneOf(ORDER_STATUS, 'Invalid order status'),

    cancelReason: yup.string().when('status', {
      is: 'cancelled',
      then: (schema) =>
        schema.required('Cancel reason is required'),
      otherwise: (schema) => schema.nullable(),
    }),
  }),
};

export const createInvoiceFromOrder = {
  params: yup.object().shape({
    orderId: yup
      .string()
      .required("Order ID is required")
      .test("is-valid-id", "Invalid Order ID", (v) => isValidObjectId(v)),
  }),

  body: yup.object().shape({
    invoiceNumber: yup
      .string()
      .required("Invoice number is required"),
  }),
};