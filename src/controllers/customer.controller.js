import expressAsyncHandler from 'express-async-handler';
import * as customerService from '../services/customer.service.js';
import { ApiResponse, ApiError } from '../utils/responseHandler.js';
import pick from '../utils/pick.js';

export const createCustomer = expressAsyncHandler(async (req, res) => {
  req.body.store = req.user.store;
  const customer = await customerService.createCustomer(req.body);
  return new ApiResponse(201, customer, 'Customer created successfully!').send(res);
});
export const updateCustomer = expressAsyncHandler(async (req, res) => {
  const customer = await customerService.updateCustomerById(req.params.id, req.body);
  if (!customer) {
    throw new ApiError(404, 'Customer not found!', [{ source: 'params', field: 'id', message: 'Customer not found' }]);
  }
  return new ApiResponse(200, customer, 'Customer updated successfully!').send(res);
});
export const getCustomerById = expressAsyncHandler(async (req, res) => {
  const customer = await customerService.getCustomerById(req.params.id);
  return new ApiResponse(200, customer, 'Customer fetched successfully!').send(res);
});
export const getCustomers = expressAsyncHandler(async (req, res) => {
  const filters = pick(req.query, ['isActive']);
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'order']);
  filters.store = req.user.store;
  const customers = await customerService.queryCustomer(filters, options);
  return new ApiResponse(200, customers, 'Customers fetched successfully!').send(res);
});
export const deleteCustomer = expressAsyncHandler(async (req, res, next) => {
  const customer = await customerService.deleteCustomerById(req.params.id);
  if (!customer) {
    throw new ApiError(404, 'Customer not found!', [{ source: 'params', field: 'id', message: 'Customer not found' }]);
  }
  return new ApiResponse(200, customer, 'Customer deleted successfully!').send(res);
});
export const getCustomersWithDue = expressAsyncHandler(async (req, res) => {
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'order']);
  const result = await customerService.getCustomersWithDue(req.user.store, options);
  return new ApiResponse(200, result, 'Customers with due amounts fetched successfully!').send(res);
});
export const getCustomerDueDetails = expressAsyncHandler(async (req, res) => {
  const customer = await customerService.getCustomerDueDetails(req.params.id);
  if (!customer) {
    throw new ApiError(404, 'Customer not found!', [{ source: 'params', field: 'id', message: 'Customer not found' }]);
  }
  return new ApiResponse(200, customer, 'Customer due details fetched successfully!').send(res);
});
