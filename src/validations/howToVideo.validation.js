import yup from 'yup';

export const createHowToVideoSchema = {
  body: yup.object().shape({
    title: yup.string().required('Title is required'),
    youtubeUrl: yup.string().required('YouTube URL is required'),
    // .matches(
    //   /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    //   'Please enter a valid YouTube URL'
    // ),
    description: yup.string(),
    tags: yup.array().of(yup.string()),
    order: yup.number().default(0),
    isActive: yup.boolean().default(true),
  }),
};

export const updateHowToVideoSchema = {
  params: yup.object().shape({
    id: yup.string().required('Video ID is required'),
  }),
  body: yup.object().shape({
    title: yup.string(),
    youtubeUrl: yup.string(),
    description: yup.string(),
    tags: yup.array().of(yup.string()),
    order: yup.number(),
    isActive: yup.boolean(),
  }),
};
