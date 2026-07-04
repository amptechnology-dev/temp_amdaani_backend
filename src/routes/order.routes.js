import { Router } from 'express';
import * as orderController from '../controllers/order.controller.js';
import validate from '../middlewares/validate.middleware.js';
import * as orderSchema from '../validations/order.validation.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { checkActiveSubscription } from '../middlewares/subscription.middleware.js';

const router = Router();

router.use(authenticate);

router
  .route('/')
  .post(checkActiveSubscription, validate(orderSchema.createOrder), orderController.createOrder)
  .get(orderController.getOrders);

router
  .route('/id/:id')
  .get(orderController.getOrderById)
  .put(validate(orderSchema.updateOrder), orderController.updateOrder);

router.put('/status/:id', validate(orderSchema.changeOrderStatus), orderController.changeOrderStatus);
router.post('/create-invoice/:orderId',validate(orderSchema.createInvoiceFromOrder), orderController.createInvoiceFromOrder);

export default router;
