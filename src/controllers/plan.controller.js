import expressAsyncHandler from 'express-async-handler';
import * as planServices from '../services/plan.service.js';
import { ApiResponse, ApiError } from '../utils/responseHandler.js';
// import pick from '../utils/pick.js';

export const createPlan = expressAsyncHandler(async (req, res) => {
  const plan = await planServices.createPlan(req.body);
  return new ApiResponse(200, plan, 'Plan created successfully!').send(res);
});
export const updatePlan = expressAsyncHandler(async (req, res) => {
  const plan = await planServices.updatePlan(req.params.id, req.body);
  if (!plan) {
    throw new ApiError(404, 'Plan not found!', [{ source: 'params', field: 'id', message: 'Plan not found' }]);
  }
  return new ApiResponse(200, plan, 'Plan updated successfully!').send(res);
});
export const getPlans = expressAsyncHandler(async (req, res) => {
  const plans = await planServices.getPlans();
  return new ApiResponse(200, plans, 'Plans fetched successfully!').send(res);
});
