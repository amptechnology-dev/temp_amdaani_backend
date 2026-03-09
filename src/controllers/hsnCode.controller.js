import expressAsyncHandler from 'express-async-handler';
import * as hsnCodeService from '../services/hsnCode.service.js';
import { ApiResponse, ApiError } from '../utils/responseHandler.js';

export const createHsnCode = expressAsyncHandler(async (req, res) => {
  const hsnCode = await hsnCodeService.createHsnCode({ store: req.user.store, ...req.body });
  return new ApiResponse(200, hsnCode, 'HsnCode created successfully!').send(res);
});
export const getHsnCodes = expressAsyncHandler(async (req, res) => {
  const hsnCodes = await hsnCodeService.getHsnCodes(req.user.store);
  return new ApiResponse(200, hsnCodes, 'HsnCodes fetched successfully!').send(res);
});
export const getHsnCodeByCode = expressAsyncHandler(async (req, res) => {
  const hsnCode = await hsnCodeService.getHsnCodeByCode(req.params.code);
  return new ApiResponse(200, hsnCode, 'HsnCode fetched successfully!').send(res);
});
export const updateHsnCode = expressAsyncHandler(async (req, res) => {
  const hsnCode = await hsnCodeService.updateHsnCodeById(req.params.id, req.body);
  if (!hsnCode) {
    throw new ApiError(404, 'HsnCode not found!', [{ source: 'params', field: 'id', message: 'HsnCode not found' }]);
  }
  return new ApiResponse(200, hsnCode, 'HsnCode updated successfully!').send(res);
});
export const deleteHsnCode = expressAsyncHandler(async (req, res) => {
  const hsnCode = await hsnCodeService.deleteHsnCodeById(req.params.id);
  return new ApiResponse(200, hsnCode, 'HsnCode deleted successfully!').send(res);
});
