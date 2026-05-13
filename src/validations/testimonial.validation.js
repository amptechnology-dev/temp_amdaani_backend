import yup from 'yup';

export const createTestimonialSchema = {
  body: yup.object().shape({
    name: yup.string().required('Name is required'),
    imageUrl:yup.string().optional(),
    designation: yup.string(),
    message: yup.string().required('Message is required'),
    youtubeLink: yup.string().optional(),
  }),
};

export const updateTestimonialSchema = {
  params: yup.object().shape({
    id: yup.string().required('Testimonial ID is required'),
  }),
  body: yup.object().shape({
    name: yup.string(),
    imageUrl: yup.string().optional(),
    designation: yup.string(),
    message: yup.string(),
    youtubeLink: yup.string(),
    isActive: yup.boolean(),
  }),
};

   
