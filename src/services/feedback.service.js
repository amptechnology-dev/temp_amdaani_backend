import { Feedback } from '../models/feedback.model.js';

export const createFeedback = async (data) => {
  return Feedback.create(data);
};

export const getFeedbackById = async (id) => {
  return Feedback.findById(id).populate('user store');
};

export const getFeedbacks = async () => {
  return Feedback.find().populate('user store');
};

export const updateFeedbackStatus = async (id, status, adminResponse = null) => {
  const update = { status };
  if (adminResponse) {
    update.adminResponse = adminResponse;
  }

  return Feedback.findByIdAndUpdate(id, update, { new: true }).populate('user store');
};

export const deleteFeedback = async (id) => {
  return Feedback.findByIdAndDelete(id);
};

// export const getStoreFeedbacks = async (storeId) => {
//   return getFeedbacks({ store: storeId });
// };

// export const getUserFeedbacks = async (userId) => {
//   return getFeedbacks({ user: userId });
// };
