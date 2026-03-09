import yup from 'yup';
import { isValidObjectId } from 'mongoose';

const purchaseItemSchema = yup.object().shape({
  product: yup
    .string()
    .test('is-valid-product-id', 'Invalid Product ID', (v) => (v ? isValidObjectId(v) : true))
    .nullable(),
  name: yup.string().required('Item name is required'),
  hsn: yup.string().nullable(),
  unit: yup.string().nullable(),
  batchNo: yup.string().nullable(),
  expiryDate: yup.date().nullable(),
  mrp: yup.number().nullable(),
  rate: yup.number().required('Rate is required').min(0, 'Rate must be >= 0'),
  gstRate: yup.number().min(0).default(0),
  isTaxInclusive: yup.boolean().default(false),
  quantity: yup.number().required('Quantity is required').min(1, 'Quantity must be at least 1'),
  discount: yup.number().min(0).default(0),
  total: yup.number().required('Total is required').min(0),
  sellingPrice: yup.number().min(0),
  sellingDiscount: yup.number().min(0),
});

export const createPurchase = {
  body: yup.object().shape({
    vendor: yup
      .string()
      .test('is-valid-vendor-id', 'Invalid Vendor ID', (v) => (v ? isValidObjectId(v) : true))
      .nullable(),
    vendorName: yup.string().trim().max(255).required('Vendor name is required'),
    vendorMobile: yup
      .string()
      .trim()
      .nullable()
      .test('is-valid-mobile', 'Vendor mobile must be a valid 10-digit number', (value) => {
        if (!value) return true;
        return /^[0-9]{10}$/.test(value);
      }),
    vendorAddress: yup.string().nullable().trim().max(255),
    vendorState: yup.string().nullable().trim().max(100),
    vendorCity: yup.string().nullable().trim().max(50),
    vendorPostalCode: yup.string().nullable().trim().max(10),
    vendorGstNumber: yup.string().nullable().trim().max(255).uppercase(),
    vendorPanNumber: yup.string().nullable().trim().max(255).uppercase(),
    invoiceNumber: yup.string().required('Purchase number is required'),
    date: yup
      .date()
      .default(() => new Date())
      .typeError('Purchase date must be a valid date'),
    items: yup.array().of(purchaseItemSchema).min(1, 'At least one item is required'),
    subTotal: yup.number().required('Sub total is required').min(0),
    gstTotal: yup.number().min(0).default(0),
    isIgst: yup.boolean().default(false),
    discountTotal: yup.number().min(0).default(0),
    roundOff: yup.number().default(0),
    grandTotal: yup.number().required('Grand total is required').min(0),
    paymentStatus: yup.string().oneOf(['paid', 'unpaid', 'partial']).default('unpaid'),
    amountPaid: yup.number().min(0).default(0),
    amountDue: yup.number().min(0).default(0),
    paymentMethod: yup.string().default('cash'),
    paymentNote: yup.string(),
    status: yup.string().oneOf(['active', 'cancelled']).default('active'),
  }),
};

export const changePurchaseStatus = {
  params: yup.object().shape({
    id: yup
      .string()
      .required('Purchase ID is required')
      .test('is-valid-purchase-id', 'Invalid Purchase ID', (v) => isValidObjectId(v)),
  }),
  body: yup.object().shape({
    status: yup.string().oneOf(['active', 'cancelled']).default('active'),
  }),
};

export const addPayment = {
  params: yup.object().shape({
    purchaseId: yup
      .string()
      .required('Purchase ID is required')
      .test('is-valid-purchase-id', 'Invalid Purchase ID', (v) => isValidObjectId(v)),
  }),
  body: yup.object().shape({
    amount: yup.number().required('Amount is required').positive('Amount must be positive').round(),
    paymentDate: yup.date().default(() => new Date()),
    paymentMethod: yup.string().oneOf(['cash', 'card', 'upi', 'bank-transfer', 'cheque']).default('cash'),
    referenceNumber: yup.string(),
    note: yup.string(),
    status: yup.string().oneOf(['pending', 'completed', 'failed', 'refunded']),
  }),
};
