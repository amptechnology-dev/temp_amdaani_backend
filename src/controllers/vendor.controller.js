import expressAsyncHandler from 'express-async-handler';
import * as vendorService from '../services/vendor.service.js';
import { ApiResponse, ApiError } from '../utils/responseHandler.js';
import pick from '../utils/pick.js';

export const createVendor = expressAsyncHandler(async (req, res) => {
  req.body.store = req.user.store;
  const vendor = await vendorService.createVendor(req.body);
  return new ApiResponse(201, vendor, 'Vendor created successfully!').send(res);
});
export const updateVendor = expressAsyncHandler(async (req, res) => {
  const vendor = await vendorService.updateVendorById(req.params.id, req.body);
  if (!vendor) {
    throw new ApiError(404, 'Vendor not found!', [{ source: 'params', field: 'id', message: 'Vendor not found' }]);
  }
  return new ApiResponse(200, vendor, 'Vendor updated successfully!').send(res);
});
export const getVendorById = expressAsyncHandler(async (req, res) => {
  const vendor = await vendorService.getVendorById(req.params.id);
  return new ApiResponse(200, vendor, 'Vendor fetched successfully!').send(res);
});
export const getVendors = expressAsyncHandler(async (req, res) => {
  const filters = pick(req.query, ['isActive']);
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'order']);
  filters.store = req.user.store;
  const vendors = await vendorService.queryVendor(filters, options);
  return new ApiResponse(200, vendors, 'Vendors fetched successfully!').send(res);
});
export const deleteVendor = expressAsyncHandler(async (req, res, next) => {
  const vendor = await vendorService.deleteVendorById(req.params.id);
  if (!vendor) {
    throw new ApiError(404, 'Vendor not found!', [{ source: 'params', field: 'id', message: 'Vendor not found' }]);
  }
  return new ApiResponse(200, vendor, 'Vendor deleted successfully!').send(res);
});

export const getVendorsWithDue = expressAsyncHandler(async (req, res) => {
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'order']);
  const vendors = await vendorService.getVendorsWithDue(req.user.store, options);
  return new ApiResponse(200, vendors, 'Vendors with due payments fetched successfully!').send(res);
});

export const getVendorDueDetails = expressAsyncHandler(async (req, res) => {
  const vendorDueDetails = await vendorService.getVendorDueDetails(req.params.id);
  if (!vendorDueDetails) {
    throw new ApiError(404, 'Vendor not found or no pending payments!', [
      { source: 'params', field: 'id', message: 'Vendor not found or no pending payments' },
    ]);
  }
  return new ApiResponse(200, vendorDueDetails, 'Vendor due details fetched successfully!').send(res);
});
