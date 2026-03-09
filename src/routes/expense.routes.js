import { Router } from 'express';
import * as expenseController from '../controllers/expense.controller.js';
import validate from '../middlewares/validate.middleware.js';
import * as expenseValidation from '../validations/expense.validation.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate);
router
  .route('/')
  .post(validate(expenseValidation.createExpenseSchema), expenseController.createExpense)
  .get(expenseController.getExpenses);
router
  .route('/id/:id')
  .get(expenseController.getExpense)
  .put(validate(expenseValidation.updateExpenseSchema), expenseController.updateExpense)
  .delete(expenseController.deleteExpense);

// Get expenses grouped by head
router.get('/grouped-by-head', expenseController.getExpensesGroupedByHead);

export default router;
