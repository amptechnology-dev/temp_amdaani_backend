import { Router } from 'express';
import * as hsnCodeController from '../controllers/hsnCode.controller.js';
import validate from '../middlewares/validate.middleware.js';
import * as hsnCodeSchema from '../validations/hsnCode.validation.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(authenticate);
router
  .route('/')
  .post(validate(hsnCodeSchema.createHsnCode), hsnCodeController.createHsnCode)
  .get(hsnCodeController.getHsnCodes);
router.route('/id/:id').put(validate(hsnCodeSchema.updateHsnCode), hsnCodeController.updateHsnCode);
router.route('/code/:code').get(hsnCodeController.getHsnCodeByCode);

export default router;
