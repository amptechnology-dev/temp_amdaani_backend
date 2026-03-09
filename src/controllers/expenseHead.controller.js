import expressAsyncHandler from 'express-async-handler';
import { ApiResponse, ApiError } from '../utils/responseHandler.js';
import * as expenseHeadService from '../services/expenseHead.service.js';
import pick from '../utils/pick.js';

export const createExpenseHead = expressAsyncHandler(async (req, res) => {
  req.body.store = req.user.store;
  const expenseHead = await expenseHeadService.createExpenseHead(req.body);
  return new ApiResponse(201, expenseHead, 'Expense head created successfully!').send(res);
});

export const updateExpenseHead = expressAsyncHandler(async (req, res) => {
  const expenseHead = await expenseHeadService.updateExpenseHeadById(
    req.params.id,
    req.body
  );
  if (!expenseHead) {
    throw new ApiError(404, 'Expense head not found!', [
      { source: 'params', field: 'id', message: 'Expense head not found' },
    ]);
  }
  return new ApiResponse(200, expenseHead, 'Expense head updated successfully!').send(res);
});

export const getExpenseHeads = expressAsyncHandler(async (req, res) => {
  const filters = pick(req.query, ['isActive']);
  filters.store = req.user.store;
  const expenseHeads = await expenseHeadService.queryExpenseHeads(filters);
  return new ApiResponse(200, expenseHeads, 'Expense heads fetched successfully!').send(res);
});

export const getExpenseHeadById = expressAsyncHandler(async (req, res) => {
  const expenseHead = await expenseHeadService.getExpenseHeadById(req.params.id);
  if (!expenseHead) {
    throw new ApiError(404, 'Expense head not found!', [
      { source: 'params', field: 'id', message: 'Expense head not found' },
    ]);
  }
  return new ApiResponse(200, expenseHead, 'Expense head fetched successfully!').send(res);
});

export const deleteExpenseHead = expressAsyncHandler(async (req, res) => {
  const expenseHead = await expenseHeadService.deleteExpenseHeadById(req.params.id);
  if (!expenseHead) {
    throw new ApiError(404, 'Expense head not found!', [
      { source: 'params', field: 'id', message: 'Expense head not found' },
    ]);
  }
  return new ApiResponse(200, expenseHead, 'Expense head deleted successfully!').send(res);
});
