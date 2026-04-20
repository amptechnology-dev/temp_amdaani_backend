import { Testimonial } from "../models/testimonial.model.js";

export const createTestimonial = async (data) => {
  console.log("Payload:", data);
  return Testimonial.create(data);
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

export const updateTestimonial = async (id, data) => {
  return Testimonial.findByIdAndUpdate(id, data, { new: true });
};

export const deleteTestimonial = async (id) => {
  return Testimonial.findByIdAndDelete(id);
};