import { Router } from 'express';
import { getActivePlans } from '../controllers/subscription.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import * as planController from '../controllers/plan.controller.js';
import validate from '../middlewares/validate.middleware.js';
import * as planSchema from '../validations/plan.validation.js';
import { authorizeRoles } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/landing-plans', getActivePlans);
router.use(authenticate);
router
  .route('/')
  .all(authorizeRoles('super-admin'))
  .get(planController.getPlans)
  .post(validate(planSchema.createPlan), planController.createPlan);
router.route('/id/:id').put(authorizeRoles('super-admin'), validate(planSchema.updatePlan), planController.updatePlan);
router.route('/active').get(getActivePlans);

export default router;
