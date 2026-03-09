import { Plan } from '../models/plan.model.js';

export const createPlan = async (data) => {
  return Plan.create(data);
};

export const updatePlan = async (planId, data) => {
  return Plan.findByIdAndUpdate(planId, data, { new: true });
};

export const getPlans = async () => {
  return Plan.find();
};
