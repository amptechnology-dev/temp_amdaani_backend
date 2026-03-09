import yup from 'yup';
import { isValidObjectId } from 'mongoose';

export const createExpenseSchema = {
  body: yup.object().shape({
    date: yup.date().required('Expense date is required'),
    head: yup
      .string()
      .required('Expense head is required')
      .test('valid-object-id', 'Invalid expense head ID', (value) => isValidObjectId(value)),
    amount: yup.number().required('Amount is required').positive('Amount must be a positive number'),
    paymentMethod: yup.string().required('Payment method is required'),
    paidTo: yup.string(),
    notes: yup.string(),
    invoiceRef: yup.string(),
    isRecurring: yup.boolean().default(false),
  }),
};

export const updateExpenseSchema = {
  params: yup.object().shape({
    id: yup.string().required('Expense ID is required'),
  }),
  body: yup.object().shape({
    date: yup.date(),
    head: yup.string(),
    amount: yup.number().positive('Amount must be a positive number'),
    paymentMethod: yup.string(),
    paidTo: yup.string(),
    notes: yup.string(),
    invoiceRef: yup.string(),
    isRecurring: yup.boolean(),
  }),
};
