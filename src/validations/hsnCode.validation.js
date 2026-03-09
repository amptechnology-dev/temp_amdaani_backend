import yup from 'yup';
import { isValidObjectId } from 'mongoose';

export const createHsnCode = {
  body: yup.object().shape({
    code: yup.string().required(),
    description: yup.string(),
    gstRate: yup.number().required().min(0).max(28),
  }),
};

export const updateHsnCode = {
  params: yup.object().shape({
    id: yup.string().required('HsnCode ID is required').test('is-object-id', 'Invalid HsnCode ID', isValidObjectId),
  }),
  body: yup.object().shape({
    code: yup.string().required(),
    description: yup.string(),
    gstRate: yup.number().required().min(0).max(28),
  }),
};
