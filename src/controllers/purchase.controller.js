import expressAsyncHandler from 'express-async-handler';
import * as purchaseService from '../services/purchase.service.js';
import { ApiResponse, ApiError } from '../utils/responseHandler.js';
import pick from '../utils/pick.js';
// import { updateUsage } from '../services/usage.service.js';
// import * as transactionService from '../services/transaction.service.js';
import {
  deleteVendorPayment,
  getVendorPaymentsByStore,
  updateVendorPaymentStatus,
} from '../services/vendorPayment.service.js';

export const createPurchase = expressAsyncHandler(async (req, res) => {
  req.body.store = req.user.store;
  const purchase = await purchaseService.createPurchase(req.body);
  return new ApiResponse(201, purchase, 'Purchase created successfully').send(res);
});
export const updatePurchase = expressAsyncHandler(async (req, res) => {
  req.body.store = req.user.store;
  const purchase = await purchaseService.updatePurchase(req.params.id, req.body);
  if (!purchase) {
    throw new ApiError(404, 'Purchase not found!', [{ source: 'params', field: 'id', message: 'Purchase not found' }]);
  }
  return new ApiResponse(200, purchase, 'Purchase updated successfully').send(res);
});
export const getPurchaseById = expressAsyncHandler(async (req, res) => {
  const purchase = await purchaseService.getPurchaseById(req.params.id);
  if (!purchase) {
    throw new ApiError(404, 'Purchase not found!', [{ source: 'params', field: 'id', message: 'Purchase not found' }]);
  }
  return new ApiResponse(200, purchase, 'Purchase fetched successfully').send(res);
});
export const getPurchases = expressAsyncHandler(async (req, res) => {
  const filters = pick(req.query, ['status']);
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'order']);
  filters.store = req.user.store;
  const purchases = await purchaseService.queryPurchases(filters, options);
  return new ApiResponse(200, purchases, 'Purchases fetched successfully').send(res);
});
export const addPayment = expressAsyncHandler(async (req, res) => {
  const { purchaseId } = req.params;
  const purchase = await purchaseService.addPaymentToPurchase(purchaseId, req.body);
  return new ApiResponse(200, purchase, 'Payment added successfully').send(res);
});
export const removePaymentFromPurchase = expressAsyncHandler(async (req, res) => {
  const { paymentId } = req.params;
  const payment = await deleteVendorPayment(paymentId);
  if (!payment) {
    throw new ApiError(404, 'Payment not found!', [
      { source: 'params', field: 'paymentId', message: 'Payment not found' },
    ]);
  }
  // Calculate and update due and status in purchase
  const amountPaid = payment.purchase.amountPaid - payment.amount;
  const amountDue = payment.purchase.amountDue + payment.amount;

  const updatedPurchase = await purchaseService.modifyDueAmount(payment.purchase, amountPaid, amountDue);
  return new ApiResponse(200, updatedPurchase, 'Payment removed successfully').send(res);
});
export const getAllVendorPaymentsByStore = expressAsyncHandler(async (req, res) => {
  const startDate = new Date(req.query.startDate);
  const endDate = new Date(req.query.endDate || new Date());

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new ApiError(400, 'Invalid date range!');
  }
  const transactions = await getVendorPaymentsByStore(req.user.store, startDate, endDate);
  return new ApiResponse(200, transactions, 'Payments fetched successfully').send(res);
});
/*
export const getLastPurchase = expressAsyncHandler(async (req, res) => {
  const purchase = await purchaseService.getLastPurchase(req.user.store);
  return new ApiResponse(200, purchase, 'Last purchase fetched successfully').send(res);
});
export const getProductWiseInvoices = expressAsyncHandler(async (req, res) => {
  const filters = pick(req.query, ['startDate', 'endDate']);
  const invoice = await invoiceService.getProductWiseInvoices({ ...filters, store: req.user.store });
  return new ApiResponse(200, invoice, 'Product wise invoices fetched successfully').send(res);
});
export const changeInvoiceStatus = expressAsyncHandler(async (req, res) => {
  const { id } = req.params;
  const status = req.body.status;
  const invoice = await invoiceService.changeInvoiceStatus(id, status);
  if (!invoice) {
    throw new ApiError(404, 'Invoice not found!', [{ source: 'params', field: 'id', message: 'Invoice not found' }]);
  }
  if (status === 'cancelled') {
    await cancelAllTransactionsForInvoice(invoice._id);
  }
  return new ApiResponse(200, invoice, 'Invoice status changed successfully').send(res);
});
*/
