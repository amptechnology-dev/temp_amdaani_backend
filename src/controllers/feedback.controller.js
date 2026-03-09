import asyncHandler from 'express-async-handler';
import { ApiResponse, ApiError } from '../utils/responseHandler.js';
import * as feedbackService from '../services/feedback.service.js';

export const createFeedback = asyncHandler(async (req, res) => {
  const feedback = await feedbackService.createFeedback({ user: req.user._id, store: req.user.store._id, ...req.body });
  return new ApiResponse(201, feedback, 'Feedback submitted successfully!').send(res);
});

export const getFeedbacks = asyncHandler(async (req, res) => {
  const feedbacks = await feedbackService.getFeedbacks();
  return new ApiResponse(200, feedbacks, 'Feedbacks retrieved successfully').send(res);
});

export const getFeedbackById = asyncHandler(async (req, res) => {
  const feedback = await feedbackService.getFeedbackById(req.params.id);
  if (!feedback) {
    throw new ApiError(404, 'Feedback not found');
  }

  return new ApiResponse(200, feedback, 'Feedback retrieved successfully').send(res);
});

export const updateFeedbackStatus = asyncHandler(async (req, res) => {
  const feedback = await feedbackService.updateFeedbackStatus(req.params.id, req.body.status, req.body.adminResponse);
  if (!feedback) {
    throw new ApiError(404, 'Feedback not found');
  }

  return new ApiResponse(200, feedback, 'Feedback status updated successfully').send(res);
});

export const deleteFeedback = asyncHandler(async (req, res) => {
  const feedback = await feedbackService.deleteFeedback(req.params.id);

  if (!feedback) {
    throw new ApiError(404, 'Feedback not found');
  }

  return new ApiResponse(200, null, 'Feedback deleted successfully').send(res);
});
