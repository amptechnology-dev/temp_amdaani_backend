import { Router } from 'express';
import * as invoiceController from '../controllers/invoice.controller.js';
import validate from '../middlewares/validate.middleware.js';
import * as invoiceSchema from '../validations/invoice.validation.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { checkActiveSubscription } from '../middlewares/subscription.middleware.js';

const router = Router();

router.use(authenticate);
router
  .route('/')
  .post(checkActiveSubscription, validate(invoiceSchema.createInvoice), invoiceController.createInvoice)
  .get(invoiceController.getInvoices);
router.route('/id/:id').get(invoiceController.getInvoiceById).put(invoiceController.updateInvoice);
router.route('/last').get(invoiceController.getLastInvoice);
router.get('/product-wise', invoiceController.getProductWiseInvoices);
router.post('/add-payment/:invoiceId', validate(invoiceSchema.addPayment), invoiceController.addPayment);
router.put('/status/:id', validate(invoiceSchema.changeInvoiceStatus), invoiceController.changeInvoiceStatus);
router.get('/transactions', invoiceController.getTransactionsByStore);
router.delete('/remove-payment/:paymentId', invoiceController.removePaymentFromInvoice);

export default router;
