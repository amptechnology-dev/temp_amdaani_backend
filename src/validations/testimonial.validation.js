import yup from 'yup';

export const createTestimonialSchema = {
  body: yup.object().shape({
    name: yup.string().required('Name is required'),
    designation: yup.string(),
    message: yup.string().required('Message is required'),
    youtubeLink: yup.string().required('YouTube Link is required'),
  }),
};

export const updateTestimonialSchema = {
  params: yup.object().shape({
    id: yup.string().required('Testimonial ID is required'),
  }),
  body: yup.object().shape({
    name: yup.string(),
    designation: yup.string(),
    message: yup.string(),
    youtubeLink: yup.string(),
    isActive: yup.boolean(),
  }),
};

   
