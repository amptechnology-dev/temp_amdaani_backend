import expressAsyncHandler from 'express-async-handler';
import { ApiResponse, ApiError } from '../utils/responseHandler.js';
import * as categoryService from '../services/category.service.js';
import pick from '../utils/pick.js';

export const createCategory = expressAsyncHandler(async (req, res) => {
  req.body.store = req.user.store;
  const category = await categoryService.createCategory(req.body);
  return new ApiResponse(200, category, 'Category created successfully!').send(res);
});
export const updateCategory = expressAsyncHandler(async (req, res) => {
  const category = await categoryService.updateCategoryById(req.params.id, req.body);
  if (!category) {
    throw new ApiError(404, 'Category not found!', [{ source: 'params', field: 'id', message: 'Category not found' }]);
  }
  return new ApiResponse(200, category, 'Category updated successfully!').send(res);
});
export const getCategories = expressAsyncHandler(async (req, res) => {
  const filters = pick(req.query, ['isActive']);
  filters.store = req.user.store;
  const category = await categoryService.queryCategory(filters);
  return new ApiResponse(200, category, 'Categories fetched successfully!').send(res);
});
export const getCategoryById = expressAsyncHandler(async (req, res) => {
  const category = await categoryService.getCategoryById(req.params.id);
  return new ApiResponse(200, category, 'Category fetched successfully!').send(res);
});
export const deleteCategory = expressAsyncHandler(async (req, res) => {
  const category = await categoryService.deleteCategoryById(req.params.id);
  return new ApiResponse(200, category, 'Category deleted successfully!').send(res);
});
