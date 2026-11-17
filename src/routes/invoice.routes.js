import { Router } from 'express';
import * as invoiceController from '../controllers/invoice.controller.js';
import validate from '../middlewares/validate.middleware.js';
import * as invoiceSchema from '../validations/invoice.validation.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireFeature } from '../middlewares/feature.middleware.js';
import { checkActiveSubscription } from '../middlewares/subscription.middleware.js';

const router = Router();

router.use(authenticate);
router
  .route('/')
  .post(checkActiveSubscription, validate(invoiceSchema.createInvoice), invoiceController.createInvoice)
  .get(invoiceController.getInvoices);
router.route('/id/:id').get(invoiceController.getInvoiceById).put(invoiceController.updateInvoice);
router.route('/last').get(invoiceController.getLastInvoice);
router.get('/product-wise',requireFeature('reports'), invoiceController.getProductWiseInvoices);
router.get('/gst-sales-report',requireFeature('reports'), invoiceController.getGstSalesReport);
router.get('/gst-sales-report/excel',requireFeature('reports'), invoiceController.exportGstSalesReportExcel);
router.get('/gst-purchase',requireFeature('reports'), invoiceController.getGstPurchaseReport);
router.get('/gst-purchase/excel',requireFeature('reports'), invoiceController.exportGstPurchaseReportExcel);
router.get('/profit-loss',requireFeature('reports'), invoiceController.getProfitLossReport);
router.get('/stock-report',requireFeature('reports'), invoiceController.getItemStockReport);
router.post('/add-payment/:invoiceId', validate(invoiceSchema.addPayment), invoiceController.addPayment);
router.put('/status/:id', validate(invoiceSchema.changeInvoiceStatus), invoiceController.changeInvoiceStatus);
router.get('/transactions', invoiceController.getTransactionsByStore);
router.delete('/remove-payment/:paymentId', invoiceController.removePaymentFromInvoice);
router.get('/customer-wise-report',requireFeature('reports'), invoiceController.getCustomerReport);
router.get('/due-collection-report',requireFeature('reports'), invoiceController.getDueCollectionReport); 

export default router;
