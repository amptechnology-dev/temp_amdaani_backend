import { Router } from 'express';
import * as purchaseController from '../controllers/purchase.controller.js';
import validate from '../middlewares/validate.middleware.js';
import * as purchaseSchema from '../validations/purchase.validation.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { checkActiveSubscription } from '../middlewares/subscription.middleware.js';

const router = Router();

router.use(authenticate);
router
  .route('/')
  .post(checkActiveSubscription, validate(purchaseSchema.createPurchase), purchaseController.createPurchase)
  .get(purchaseController.getPurchases);
router.put('/id/:id', validate(purchaseSchema.updatePurchase), purchaseController.updatePurchase);
router.route('/id/:id').get(purchaseController.getPurchaseById);
router.post('/add-payment/:purchaseId', validate(purchaseSchema.addPayment), purchaseController.addPayment);
router.delete('/remove-payment/:paymentId', purchaseController.removePaymentFromPurchase);
router.get('/transactions', purchaseController.getAllVendorPaymentsByStore);
/*
router.route('/last').get(purchaseController.getLastInvoice);
router.get('/product-wise', purchaseController.getProductWiseInvoices);
router.put('/status/:id', validate(purchaseSchema.changePurchaseStatus), purchaseController.changePurchaseStatus);
*/

export default router;
