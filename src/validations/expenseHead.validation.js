import yup from 'yup';

export const createExpenseHeadSchema = {
  body: yup.object().shape({
    name: yup.string().required('Expense head name is required').trim(),
  }),
};

export const updateExpenseHeadSchema = {
  params: yup.object().shape({
    id: yup.string().required('Expense head ID is required'),
  }),
  body: yup.object().shape({
    name: yup.string().trim(),
    isActive: yup.boolean(),
  }),
};

export const deleteExpenseHeadSchema = {
  params: yup.object().shape({
    id: yup.string().required('Expense head ID is required'),
  }),
};
