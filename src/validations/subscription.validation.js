import yup from 'yup';
import { isValidObjectId } from 'mongoose';

export const createSubscription = {
  body: yup.object().shape({
    plan: yup.string().required().test('is-valid-plan-id', 'Invalid Plan ID', isValidObjectId),
  }),
};
