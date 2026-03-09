import { Router } from 'express';
import * as customerController from '../controllers/customer.controller.js';
import validate from '../middlewares/validate.middleware.js';
import * as customerSchema from '../validations/customer.validation.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate);
router
  .route('/')
  .post(validate(customerSchema.createCustomerSchema), customerController.createCustomer)
  .get(customerController.getCustomers);
router
  .route('/id/:id')
  .get(customerController.getCustomerById)
  .put(validate(customerSchema.updateCustomerSchema), customerController.updateCustomer)
  .delete(customerController.deleteCustomer);
router.route('/due').get(customerController.getCustomersWithDue);
router.route('/due/:id').get(customerController.getCustomerDueDetails);

export default router;
