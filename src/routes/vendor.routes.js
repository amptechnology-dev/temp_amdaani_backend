import { Router } from 'express';
import * as vendorController from '../controllers/vendor.controller.js';
import validate from '../middlewares/validate.middleware.js';
import * as vendorSchema from '../validations/vendor.validation.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate);
router
  .route('/')
  .post(validate(vendorSchema.createVendorSchema), vendorController.createVendor)
  .get(vendorController.getVendors);
router
  .route('/id/:id')
  .get(vendorController.getVendorById)
  .put(validate(vendorSchema.updateVendorSchema), vendorController.updateVendor)
  .delete(vendorController.deleteVendor);
router.route('/due').get(vendorController.getVendorsWithDue);
router.route('/due/:id').get(vendorController.getVendorDueDetails);

export default router;
