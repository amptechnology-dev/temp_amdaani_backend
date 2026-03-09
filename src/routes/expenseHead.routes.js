import { Router } from 'express';
import * as expenseHeadController from '../controllers/expenseHead.controller.js';
import validate from '../middlewares/validate.middleware.js';
import * as expenseHeadSchema from '../validations/expenseHead.validation.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate);

router
  .route('/')
  .post(validate(expenseHeadSchema.createExpenseHeadSchema), expenseHeadController.createExpenseHead)
  .get(expenseHeadController.getExpenseHeads);

router
  .route('/id/:id')
  .get(expenseHeadController.getExpenseHeadById)
  .put(validate(expenseHeadSchema.updateExpenseHeadSchema), expenseHeadController.updateExpenseHead)
  .delete(validate(expenseHeadSchema.deleteExpenseHeadSchema), expenseHeadController.deleteExpenseHead);

export default router;
