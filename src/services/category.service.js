import { Category } from '../models/category.model.js';
import { Product } from '../models/product.model.js';
import { ApiError } from '../utils/responseHandler.js';
import { handleDuplicateKeyError } from '../utils/dbErrorHandler.js';

export const createCategory = async (data, session = null) => {
  try {
    const category = new Category(data);
    return await category.save(session ? { session } : undefined);
  } catch (error) {
    handleDuplicateKeyError(error, Category);
  }
};

export const queryCategory = async (filter = {}) => {
  return Category.find(filter);
};

export const getCategoryById = async (id) => {
  return Category.findById(id);
};

export const updateCategoryById = async (id, data, session = null) => {
  try {
    return await Category.findByIdAndUpdate(id, data, { session, new: true, runValidators: true });
  } catch (error) {
    handleDuplicateKeyError(error, Category);
  }
};

export const deleteCategoryById = async (id) => {
  if (await Product.exists({ category: id })) {
    throw new ApiError(400, 'Category has products', [
      { source: 'body', field: 'id', message: 'Category has products!' },
    ]);
  }
  return Category.findByIdAndDelete(id);
};
