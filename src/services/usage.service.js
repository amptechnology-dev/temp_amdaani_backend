import { Usage } from '../models/usage.model.js';

export const createUsage = async (data) => {
  return Usage.create(data);
};

export const resetUsage = async (subscriptionId) => {
  return Usage.findOneAndUpdate({ subscription: subscriptionId }, { invoicesUsed: 0 }, { upsert: true, new: true });
};

export const getUsage = async (subscriptionId) => {
  return Usage.findOne({ subscription: subscriptionId });
};

export const updateUsage = async (subscriptionId, data) => {
  return Usage.findOneAndUpdate({ subscription: subscriptionId }, data, { upsert: true, new: true });
};
