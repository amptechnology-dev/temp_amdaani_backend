import yup from 'yup';
import { isValidObjectId } from 'mongoose';

export const createVendorSchema = {
  body: yup.object().shape({
    name: yup.string().trim().max(255, 'Category name must be at most 255 characters'),
    mobile: Yup.string()
      .trim()
      .required('Contact number is required')
      .test('mobile-or-landline', 'Enter a valid Indian mobile or landline number', (value) => {
        if (!value) return false;
        const digits = value.replace(/\D/g, '');
        const mobileRegex = /^[6-9]\d{9}$/; // 10-digit mobile
        const landlineRegex = /^0\d{7,11}$/; // STD code (0) + 7–11 digits
        return mobileRegex.test(digits) || landlineRegex.test(digits);
      }),
    address: yup.string().trim().max(150),
    city: yup.string().trim().max(50),
    state: yup.string().trim().max(100),
    country: yup.string().trim().max(100),
    postalCode: yup.string().trim().max(10),
    gstNumber: yup.string().trim().uppercase(),
    panNumber: yup.string().trim().uppercase(),
    isActive: yup.boolean().default(true),
  }),
};

export const updateVendorSchema = {
  params: yup.object().shape({
    id: yup.string().required('Vendor ID is required').test('is-object-id', 'Invalid Vendor ID', isValidObjectId),
  }),
  body: yup
    .object()
    .shape({
      name: yup.string().trim().max(255, 'Category name must be at most 255 characters'),
      mobile: Yup.string()
        .trim()
        .required('Contact number is required')
        .test('mobile-or-landline', 'Enter a valid Indian mobile or landline number', (value) => {
          if (!value) return false;
          const digits = value.replace(/\D/g, '');
          const mobileRegex = /^[6-9]\d{9}$/; // 10-digit mobile
          const landlineRegex = /^0\d{7,11}$/; // STD code (0) + 7–11 digits
          return mobileRegex.test(digits) || landlineRegex.test(digits);
        }),
      address: yup.string().trim().max(150),
      city: yup.string().trim().max(50),
      state: yup.string().trim().max(100),
      country: yup.string().trim().max(100),
      postalCode: yup.string().trim().max(10),
      gstNumber: yup.string().trim().uppercase(),
      panNumber: yup.string().trim().uppercase(),
      isActive: yup.boolean(),
    })
    .test('emty-body', 'At least one field must be updated', (v) => v && Object.keys(v).length > 0),
};
