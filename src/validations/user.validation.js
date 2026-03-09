import yup from 'yup';

export const createUser = {
  body: yup.object().shape({
    phone: yup.string().required().trim(),
    name: yup.string().required().trim(),
    email: yup.string().email().trim().lowercase(),
    // isVerified: yup.boolean().default(false),
    // role: yup.string().oneOf(Object.values(roles)).default(roles.OWNER),
    preferences: yup.object().shape({
      language: yup.string().default('en'),
      //   notifications: yup.object({
      //     paymentReminder: yup.boolean().default(true),
      //   }),
    }),
  }),
};
