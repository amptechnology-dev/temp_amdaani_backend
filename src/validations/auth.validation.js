import yup from 'yup';
import { createStore } from './store.validation.js';
import { createUser } from './user.validation.js';

export const register = {
  body: yup.object().shape({
    storeData: createStore.body,
    userData: createUser.body,
  }),
};

export const login = {
  body: yup.object().shape({
    username: yup.string().required(),
    password: yup.string().required(),
  }),
};

export const refreshToken = {
  body: yup.object().shape({
    refreshToken: yup.string(),
  }),
};

export const forgotPassword = {
  body: yup.object().shape({
    email: yup.string().email().required(),
  }),
};

export const resetPassword = {
  query: yup.object().shape({
    token: yup.string().required(),
  }),
  body: yup.object().shape({
    password: yup.string().required().min(4).max(20),
  }),
};
