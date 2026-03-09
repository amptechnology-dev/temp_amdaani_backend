import { Router } from 'express';
import * as categoryController from '../controllers/category.controller.js';
import validate from '../middlewares/validate.middleware.js';
import * as categorySchema from '../validations/category.validation.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate);
router
  .route('/')
  .post(validate(categorySchema.createCategorySchema), categoryController.createCategory)
  .get(categoryController.getCategories);
router
  .route('/id/:id')
  .get(categoryController.getCategoryById)
  .put(validate(categorySchema.updateCategorySchema), categoryController.updateCategory)
  .delete(categoryController.deleteCategory);

export default router;
