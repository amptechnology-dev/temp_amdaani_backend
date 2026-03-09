import expressAsyncHandler from 'express-async-handler';
import * as adsService from '../services/ads.service.js';
import { ApiResponse, ApiError } from '../utils/responseHandler.js';
import pick from '../utils/pick.js';

export const createAd = expressAsyncHandler(async (req, res) => {
  const ad = await adsService.createAd(req.body, req.file);
  return new ApiResponse(201, ad, 'Ad created successfully!').send(res);
});
export const getAds = expressAsyncHandler(async (req, res) => {
  const filters = pick(req.query, ['isActive', 'running']);
  if (filters.running === 'true' || filters.running === true) {
    filters.startDate = { $lte: new Date() };
    filters.endDate = { $gte: new Date() };
  }
  delete filters.running;
  const ads = await adsService.getAds(filters);
  return new ApiResponse(200, ads, 'Ads fetched successfully!').send(res);
});
export const updateAd = expressAsyncHandler(async (req, res) => {
  const ad = await adsService.updateAdById(req.params.id, req.body, req.file);
  if (!ad) {
    throw new ApiError(404, 'Ad not found!', [{ source: 'params', field: 'id', message: 'Ad not found' }]);
  }
  return new ApiResponse(200, ad, 'Ad updated successfully!').send(res);
});
export const getAdById = expressAsyncHandler(async (req, res) => {
  const ad = await adsService.getAdById(req.params.id);
  if (!ad) {
    throw new ApiError(404, 'Ad not found!', [{ source: 'params', field: 'id', message: 'Ad not found' }]);
  }
  return new ApiResponse(200, ad, 'Ad fetched successfully!').send(res);
});
