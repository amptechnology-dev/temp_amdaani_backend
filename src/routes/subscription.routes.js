import { Router } from 'express';
import * as subscriptionController from '../controllers/subscription.controller.js';
// import validate from '../middlewares/validate.middleware.js';
// import * as subscriptionSchema from '../validations/subscription.validation.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.route('/verify-payment').post(subscriptionController.verifyPayment);
router.use(authenticate);
router.route('/get-free').post(subscriptionController.createOrRenewFreePlan);
router.route('/initiate-payment').post(subscriptionController.initiatePayment);
router.route('/get-active-subscriptions').get(subscriptionController.getActiveSubscription);
router.route('/get-last-subscription').get(subscriptionController.getLastSubscription);
router.route('/get-payments').get(subscriptionController.getPayments);
router.route('/get-upcoming-subscriptions').get(subscriptionController.getUpcomingSubscriptions);

// router
//   .route('/id/:id')
//   .get(subscriptionController.getSubscriptionById)
//   .put(validate(subscriptionSchema.updateSubscription), subscriptionController.updateSubscription)
//   .delete(subscriptionController.deleteSubscription);

export default router;
