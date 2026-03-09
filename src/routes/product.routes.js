import { Router } from 'express';
import * as productController from '../controllers/product.controller.js';
import validate from '../middlewares/validate.middleware.js';
import * as productSchema from '../validations/product.validation.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate);
router
  .route('/')
  .post(validate(productSchema.createProductSchema), productController.createProduct)
  .get(productController.getProducts);
router
  .route('/id/:id')
  .get(productController.getProductById)
  .put(validate(productSchema.updateProductSchema), productController.updateProduct);
//   .delete(productController.de);
router.route('/adjust-stock').post(validate(productSchema.adjustStockSchema), productController.adjustProductStock);
router.route('/stock-transaction/:id').get(productController.getStockTransactionsByProduct);
router.route('/sales').get(productController.getAllProductsWithSales);

export default router;
