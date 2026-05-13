import { Testimonial } from "../models/testimonial.model.js";
import { compressAndUpload, deleteFileFromR2 } from '../services/image.service.js';
import config from '../config/config.js';

export const createTestimonial = async (data, file) => {
  let uploadedImage;
  try {
    if (file) {
      uploadedImage = await compressAndUpload(file.buffer, { isPublic: true });
      data.imageUrl = `${config.r2.publicEndpoint}/${uploadedImage}`;
    }
    return Testimonial.create(data);
  } catch (error) {
    if (uploadedImage) await deleteFileFromR2(true, uploadedImage);
    throw error;
  }
};

export const getAllTestimonials = async () => {
  return Testimonial.find();
};

export const getActiveTestimonials = async () => {
  return Testimonial.find({ isActive: true });
};

export const getTestimonialById = async (id) => {
  return Testimonial.findById(id);
};

export const updateTestimonial = async (id, data, file) => {
  let uploadedImage;
  try {
    if (file) {
      uploadedImage = await compressAndUpload(file.buffer, { isPublic: true });
      data.imageUrl = `${config.r2.publicEndpoint}/${uploadedImage}`;
    }
    return Testimonial.findByIdAndUpdate(id, data, { new: true });
  } catch (error) {
    if (uploadedImage) await deleteFileFromR2(true, uploadedImage);
    throw error;
  }
};

export const deleteTestimonial = async (id) => {
  return Testimonial.findByIdAndDelete(id);
};