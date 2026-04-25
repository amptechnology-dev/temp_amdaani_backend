import yup from 'yup';
// import { isValidObjectId } from 'mongoose';

export const createStore = {
  body: yup.object().shape({
    name: yup.string().required().trim(),
    type: yup.string().required(),
    tagline: yup.string().trim().max(100),
    ownershipType: yup.string().trim(),
    gstNumber: yup.string().trim().uppercase(),
    panNumber: yup.string().trim().uppercase(),
    registrationNo: yup.string().trim(),
    contactNo: yup.string().trim(),
    email: yup.string().trim().lowercase().email(),

    // 🔥 referral code used during signup
    usedReferralCode: yup
      .string()
      .trim()
      .uppercase()
      .optional(),

    address: yup
      .object()
      .shape({
        street: yup.string().required(),
        city: yup.string().required(),
        state: yup.string().required(),
        country: yup.string().default('IN'),
        postalCode: yup.string().required(),
      })
      .required(),

    bankDetails: yup.object().shape({
      bankName: yup.string(),
      accountNo: yup.string(),
      holderName: yup.string(),
      ifsc: yup.string(),
      branch: yup.string(),
      upiId: yup.string(),
    }),

    settings: yup.object().shape({
      invoicePrefix: yup.string().default('INV'),
      invoiceStartNumber: yup.number().default(1),
      taxRates: yup
        .array()
        .of(
          yup.object({
            name: yup.string().required(),
            rate: yup.number().required(),
          })
        )
        .optional(),
      invoiceTerms: yup.string(),
    }),
  }),
};

export const updateStore = {
  body: yup.object().shape({
    tagline: yup.string(),
    ownershipType: yup.string().trim(),
    gstNumber: yup
      .string()
      .trim()
      .uppercase()
      .matches(/^[0-9A-Z]{15}$/, 'Invalid GST number')
      .nullable(),
    panNumber: yup
      .string()
      .trim()
      .uppercase()
      .matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid PAN number')
      .nullable(),
    registrationNo: yup.string().trim().nullable(),
    contactNo: yup.string().trim(),
    email: yup.string().trim().lowercase().email(),
    address: yup.object().shape({
      street: yup.string().trim(),
      city: yup.string().trim(),
      state: yup.string().trim(),
      postalCode: yup.string().trim(),
    }),
    bankDetails: yup.object().shape({
      bankName: yup.string().trim(),
      accountNo: yup.string().trim(),
      holderName: yup.string().trim(),
      ifsc: yup.string().trim(),
      branch: yup.string().trim(),
      upiId: yup.string().trim(),
    }),
    settings: yup.object().shape({
      // invoicePrefix: yup.string().trim().default('INV'),
      // invoiceStartNumber: yup.number().min(1).default(1),
      // taxRates: yup.array().of(taxRateSchema),
      invoiceTerms: yup.string(),
      stockManagement: yup.boolean().default(false),
      purchaseOrderManagement: yup.boolean().default(false),
    }),
  }),
};

export const createStoreUser = {
  body: yup.object().shape({
    phone: yup.string().required().trim(),
    name: yup.string().required().trim(),
    email: yup.string().email().trim().lowercase(),
    // isVerified: yup.boolean().default(false),
    role: yup.string().required(),
    preferences: yup.object().shape({
      language: yup.string().default('en'),
      //   notifications: yup.object({
      //     paymentReminder: yup.boolean().default(true),
      //   }),
    }),
  }),
};
