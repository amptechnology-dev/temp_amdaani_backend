import expressAsyncHandler from 'express-async-handler';
import { ApiResponse, ApiError } from '../utils/responseHandler.js';
import * as expenseService from '../services/expense.service.js';
import pick from '../utils/pick.js';

export const createExpense = expressAsyncHandler(async (req, res) => {
  req.body.store = req.user.store;
  req.body.enteredBy = req.user._id;
  const expense = await expenseService.createExpense(req.body);
  return new ApiResponse(201, expense, 'Expense created successfully!').send(res);
});

export const updateExpense = expressAsyncHandler(async (req, res) => {
  const expense = await expenseService.updateExpense(req.params.id, req.body);
  if (!expense) {
    throw new ApiError(404, 'Expense not found!', [{ source: 'params', field: 'id', message: 'Expense not found' }]);
  }
  return new ApiResponse(200, expense, 'Expense updated successfully!').send(res);
});

export const getExpenses = expressAsyncHandler(async (req, res) => {
  const filters = pick(req.query, ['startDate', 'endDate']);
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'order']);

  // Add store filter
  filters.store = req.user.store;
  // Convert date strings to Date objects if they exist
  if (filters.startDate) filters.startDate = new Date(filters.startDate).setHours(0, 0, 0, 0);
  if (filters.endDate) filters.endDate = new Date(filters.endDate).setHours(23, 59, 59, 999);

  const expenses = await expenseService.queryExpenses(filters, options);
  return new ApiResponse(200, expenses, 'Expenses fetched successfully!').send(res);
});

export const getExpense = expressAsyncHandler(async (req, res) => {
  const expense = await expenseService.getExpenseById(req.params.id);
  if (!expense) {
    throw new ApiError(404, 'Expense not found!', [{ source: 'params', field: 'id', message: 'Expense not found' }]);
  }
  return new ApiResponse(200, expense, 'Expense fetched successfully!').send(res);
});

export const deleteExpense = expressAsyncHandler(async (req, res) => {
  const expense = await expenseService.deleteExpense(req.params.id);
  if (!expense) {
    throw new ApiError(404, 'Expense not found!', [{ source: 'params', field: 'id', message: 'Expense not found' }]);
  }
  return new ApiResponse(200, null, 'Expense deleted successfully!').send(res);
});

export const getExpensesGroupedByHead = expressAsyncHandler(async (req, res) => {

  const { range, startDate, endDate } = req.query;

  const now = new Date();
  let start;
  let end;

  if (range === "thisMonth") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }

  if (range === "previousMonth") {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  }

  if (range === "year") {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  }

  const finalStartDate =
    start || (startDate ? new Date(startDate).setHours(0, 0, 0, 0) : null);

  const finalEndDate =
    end || (endDate ? new Date(endDate).setHours(23, 59, 59, 999) : null);

  const expensesByHead = await expenseService.getExpensesGroupedByHead(
    req.user.store,
    {
      startDate: finalStartDate,
      endDate: finalEndDate,
    }
  );

  return new ApiResponse(
    200,
    expensesByHead,
    "Expenses grouped by head fetched successfully!"
  ).send(res);

});
