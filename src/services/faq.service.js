import { FAQ } from "../models/faq.model.js";

export const createFaq = async (data) => {
  return FAQ.create(data);
};

export const getAllFaqs = async () => {
  return FAQ.find({ isWeb: { $ne: true } }).sort({ createdAt: -1 });
};

export const getAdminFaqs = async () => {
  return FAQ.find().sort({ createdAt: -1 });
}

export const getWebFaqs = async () => {
  return FAQ.find({ isWeb: true }).sort({ createdAt: -1 });
}

export const getFaqById = async (id) => {
  return FAQ.findById(id);
};

export const updateFaq = async (id, data) => {
  return FAQ.findByIdAndUpdate(id, data, { new: true });
};

export const deleteFaq = async (id) => {
  return FAQ.findByIdAndDelete(id);
};