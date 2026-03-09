import { ExpenseHead } from '../models/expenseHead.model.js';
import { Expense } from '../models/expense.model.js';
import { ApiError } from '../utils/responseHandler.js';
import { handleDuplicateKeyError } from '../utils/dbErrorHandler.js';

export const createExpenseHead = async (data, session = null) => {
  try {
    const expenseHead = new ExpenseHead(data);
    return await expenseHead.save(session ? { session } : undefined);
  } catch (error) {
    handleDuplicateKeyError(error, ExpenseHead);
  }
};

export const queryExpenseHeads = async (filter = {}) => {
  return ExpenseHead.find(filter).sort({ name: 1 });
};

export const getExpenseHeadById = async (id) => {
  return ExpenseHead.findById(id);
};

export const updateExpenseHeadById = async (id, data, session = null) => {
  try {
    return await ExpenseHead.findByIdAndUpdate(id, data, {
      session,
      new: true,
      runValidators: true,
    });
  } catch (error) {
    handleDuplicateKeyError(error, ExpenseHead);
  }
};

export const deleteExpenseHeadById = async (id) => {
  // Check if there are any expenses associated with this expense head
  if (await Expense.exists({ category: id })) {
    throw new ApiError(400, 'Expenses found!', [
      { source: 'body', field: 'id', message: 'Expense head has associated expenses!' },
    ]);
  }

  return ExpenseHead.findByIdAndDelete(id);
};
