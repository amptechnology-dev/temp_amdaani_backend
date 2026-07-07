import yup from 'yup';
import { isValidObjectId } from 'mongoose';
import { ORDER_STATUS } from '../config/constants.js';
import { createInvoice } from './invoice.validation.js';

const orderItemSchema = yup.object().shape({
  product: yup
    .string()
    .required('Product ID is required')
    .test('is-valid-product-id', 'Invalid Product ID', (v) => isValidObjectId(v)),

  sellingPrice: yup
    .number()
    .required('Selling price is required')
    .min(0, 'Selling price must be greater than or equal to 0'),

  quantity: yup.number().required('Quantity is required').min(1, 'Quantity must be at least 1'),
});

export const createOrder = {
  body: yup.object().shape({
    customer: yup
      .string()
      .required('Customer is required')
      .test('is-valid-customer-id', 'Invalid Customer ID', (v) => isValidObjectId(v)),

    orderNumber: yup.string().trim().required('Order number is required'),

    orderDate: yup
      .date()
      .default(() => new Date())
      .typeError('Order date must be a valid date'),

    items: yup.array().of(orderItemSchema).required('Items are required').min(1, 'At least one item is required'),
  }),
};

export const updateOrder = {
  params: yup.object().shape({
    id: yup
      .string()
      .required('Order ID is required')
      .test('is-valid-order-id', 'Invalid Order ID', (v) => isValidObjectId(v)),
  }),

  body: createOrder.body,
};

export const changeOrderStatus = {
  params: yup.object().shape({
    id: yup
      .string()
      .required('Order ID is required')
      .test('is-valid-order-id', 'Invalid Order ID', (v) => isValidObjectId(v)),
  }),

  body: yup.object().shape({
    status: yup.string().required('Status is required').oneOf(ORDER_STATUS, 'Invalid order status'),

    deliveredBy: yup.string().when('status', {
      is: 'delivered',
      then: (schema) => schema.required('Delivered By is required'),
      otherwise: (schema) => schema.strip(),
    }),

    challanNo: yup.string().when('status', {
      is: 'delivered',
      then: (schema) => schema.required('Challan No is required'),
      otherwise: (schema) => schema.strip(),
    }),

    challanDate: yup.date().when('status', {
      is: 'delivered',
      then: (schema) => schema.required('Challan Date is required'),
      otherwise: (schema) => schema.strip(),
    }),

    lorryNumber: yup.string().when('status', {
      is: 'delivered',
      then: (schema) => schema.required('Lorry Number is required'),
      otherwise: (schema) => schema.strip(),
    }),

    deliveryAddress: yup.string().when('status', {
      is: 'delivered',
      then: (schema) => schema.required('Delivery Address is required'),
      otherwise: (schema) => schema.strip(),
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

  body: createInvoice.body,
};
