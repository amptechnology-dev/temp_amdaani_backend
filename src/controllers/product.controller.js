import expressAsyncHandler from 'express-async-handler';
import { ApiResponse, ApiError } from '../utils/responseHandler.js';
import * as productService from '../services/product.service.js';
import pick from '../utils/pick.js';

export const createProduct = expressAsyncHandler(async (req, res) => {
  req.body.store = req.user.store;

  const product = await productService.createProduct(req.body);
  return new ApiResponse(200, product, 'Product created successfully!').send(res);
});
export const updateProduct = expressAsyncHandler(async (req, res) => {
  const product = await productService.updateProductById(req.params.id, req.body);
  if (!product) {
    throw new ApiError(404, 'Product not found!', [{ source: 'params', field: 'id', message: 'Product not found' }]);
  }
  return new ApiResponse(200, product, 'Product updated successfully!').send(res);
});
export const getProducts = expressAsyncHandler(async (req, res) => {
  const filters = pick(req.query, ['category', 'status']);
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'order']);
  filters.store = req.user.store;
  const products = await productService.queryProduct(filters, options);
  return new ApiResponse(200, products, 'Products fetched successfully!').send(res);
});
export const getProductById = expressAsyncHandler(async (req, res) => {
  const product = await productService.getProductById(req.params.id);
  return new ApiResponse(200, product, 'Product fetched successfully!').send(res);
});
export const getAllProductsWithSales = expressAsyncHandler(async (req, res) => {
  const products = await productService.getAllProductsWithSales(req.user.store, req.query.startDate, req.query.endDate);
  return new ApiResponse(200, products, 'Products fetched successfully!').send(res);
});
export const adjustProductStock = expressAsyncHandler(async (req, res) => {
  const result = await productService.adjustProductStock(req.body);
  return new ApiResponse(200, result, 'Stock adjusted successfully').send(res);
});
export const getStockTransactionsByProduct = expressAsyncHandler(async (req, res) => {
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'order']);
  const filters = pick(req.query, ['startDate', 'endDate']);
  filters.store = req.user.store;
  const result = await productService.getStockTransactionsByProduct(req.params.id, filters, options);
  return new ApiResponse(200, result, 'Stock transactions fetched successfully').send(res);
});
