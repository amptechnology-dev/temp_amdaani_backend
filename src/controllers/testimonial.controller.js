import expressAsyncHandler from "express-async-handler";
import * as testimonialService from "../services/testimonial.service.js";
import { ApiResponse, ApiError } from "../utils/responseHandler.js";

export const createTestimonial = expressAsyncHandler(async (req, res) => {

  const testimonial = await testimonialService.createTestimonial(req.body);

  console.log("Created Testimonial..... Payload", testimonial);

  return new ApiResponse(
    201,
    testimonial,
    "Testimonial created successfully!"
  ).send(res);
});

export const getAllTestimonials = expressAsyncHandler(async (req, res) => {

  const testimonials = await testimonialService.getAllTestimonials();

  return new ApiResponse(
    200,
    testimonials,
    "Testimonials fetched successfully!"
  ).send(res);
});

export const getTestimonialById = expressAsyncHandler(async (req, res) => {

  const testimonial = await testimonialService.getTestimonialById(req.params.id);

  if (!testimonial) {
    throw new ApiError(404, "Testimonial not found");
  }

  return new ApiResponse(
    200,
    testimonial,
    "Testimonial fetched successfully!"
  ).send(res);
});

export const updateTestimonial = expressAsyncHandler(async (req, res) => {

  const testimonial = await testimonialService.updateTestimonial(
    req.params.id,
    req.body
  );

  if (!testimonial) {
    throw new ApiError(404, "Testimonial not found");
  }

  return new ApiResponse(
    200,
    testimonial,
    "Testimonial updated successfully!"
  ).send(res);
});

export const deleteTestimonial = expressAsyncHandler(async (req, res) => {

  await testimonialService.deleteTestimonial(req.params.id);

  return new ApiResponse(
    200,
    null,
    "Testimonial deleted successfully!"
  ).send(res);
});