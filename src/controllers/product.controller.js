import expressAsyncHandler from 'express-async-handler';
import { ApiResponse, ApiError } from '../utils/responseHandler.js';
import * as productService from '../services/product.service.js';
import pick from '../utils/pick.js';

export const createProduct = expressAsyncHandler(async (req, res) => {
  req.body.store = req.user.store;
  req.body.userId = req.user.id;
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
  const { range, startDate, endDate, search = '' } = req.query;

  const now = new Date();
  let start = null;
  let end = null;

  if (range) {
    switch (range) {
      case 'today':
        start = new Date(now.setHours(0, 0, 0, 0));
        end = new Date(now.setHours(23, 59, 59, 999));
        break;
      case 'thisMonth':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case 'previousMonth':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      case 'custom':
        start = startDate ? new Date(startDate) : null;
        end = endDate ? new Date(endDate) : null;
        break;
    }
  } else {
    start = startDate ? new Date(startDate) : null;
    end = endDate ? new Date(endDate) : null;
  }

  if (start && isNaN(start.getTime())) start = null;
  if (end && isNaN(end.getTime())) end = null;

  const products = await productService.getAllProductsWithSales(req.user.store, start, end, search);

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
  console.log('-->', result);

  return new ApiResponse(200, result, 'Stock transactions fetched successfully').send(res);
});

export const carryForwardStock = expressAsyncHandler(async (req, res) => {
  const storeId = req.user.store;
  const result = await productService.carryForwardStockToNextFinancialYear(storeId);

  return new ApiResponse(200, result, 'Financial year stock carried forward successfully').send(res);
});

export const getProductSuggestions = expressAsyncHandler(async (req, res) => {
  const { search = '' } = req.query;

  const data = await productService.getProductSuggestions(req.user.store, search);

  return new ApiResponse(200, data, 'Product suggestions fetched successfully!').send(res);
});
