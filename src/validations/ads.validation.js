import yup from 'yup';

export const createAd = {
  body: yup.object().shape({
    title: yup.string().required().trim(),
    redirectUrl: yup.string().required().url().trim(),
    position: yup.string().required().oneOf(['dashboard', 'invoice_footer', 'invoice_header']).default('dashboard'),
    startDate: yup.date().required(),
    endDate: yup.date().required(),
    priority: yup.number().default(0),
  }),
};

export const updateAd = {
  params: yup.object().shape({
    id: yup.string().required('Ad ID is required'),
  }),
  body: yup.object().shape({
    title: yup.string().trim(),
    redirectUrl: yup.string().url().trim(),
    position: yup.string().oneOf(['dashboard', 'invoice_footer', 'invoice_header']),
    startDate: yup.date(),
    endDate: yup.date(),
    priority: yup.number(),
    isActive: yup.boolean(),
  }),
};
