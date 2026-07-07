import expressAsyncHandler from 'express-async-handler';
import * as purchaseService from '../services/purchase.service.js';
import { ApiResponse, ApiError } from '../utils/responseHandler.js';
import { deleteTransaction, cancelAllTransactionsForInvoice } from '../services/transaction.service.js';
import pick from '../utils/pick.js';
// import { updateUsage } from '../services/usage.service.js';
// import * as transactionService from '../services/transaction.service.js';
import * as invoiceService from '../services/invoice.service.js';
import {
  deleteVendorPayment,
  getVendorPaymentsByStore,
  updateVendorPaymentStatus,
} from '../services/vendorPayment.service.js';
import { Purchase } from '../models/purchase.model.js';

export const createPurchase = expressAsyncHandler(async (req, res) => {
  req.body.store = req.user.store;
  req.body.userId = req.user.id;
  const purchase = await purchaseService.createPurchase(req.body);
  return new ApiResponse(201, purchase, 'Purchase created successfully').send(res);
});
export const updatePurchase = expressAsyncHandler(async (req, res) => {
  req.body.store = req.user.store;
  req.body.userId = req.user.id;
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

// export const deletePurchase = expressAsyncHandler(async (req, res) => {
//   req.body.store = req.user.store;
//   const purchase = await purchaseService.deletePurchase(req.params.id, req.user.store);
//   if (!purchase) {
//     throw new ApiError(404, 'Purchase not found!', [
//       { source: 'params', field: 'id', message: 'Purchase not found' },
//     ]);
//   }
//   return new ApiResponse(200, purchase, 'Purchase deleted successfully').send(res);
// });

export const getAllVendorPaymentsByStore = expressAsyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  let parsedStartDate = null;
  let parsedEndDate = null;

  // Validate only if date exists
  if (startDate && endDate) {
    parsedStartDate = new Date(startDate);

    parsedEndDate = new Date(endDate);

    if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
      throw new ApiError(400, 'Invalid date range!');
    }
  }

  const transactions = await getVendorPaymentsByStore(req.user.store, parsedStartDate, parsedEndDate);

  return new ApiResponse(200, transactions, 'Payments fetched successfully').send(res);
});

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

export const changePurchaseStatus = expressAsyncHandler(async (req, res) => {
  const { id } = req.params;
  const status = req.body.status;
  const invoice = await purchaseService.changePurchaseInvoiceStatus(id, status);
  if (!invoice) {
    throw new ApiError(404, 'Invoice not found!', [{ source: 'params', field: 'id', message: 'Invoice not found' }]);
  }
  if (status === 'cancelled') {
    await cancelAllTransactionsForInvoice(invoice._id);
  }

  if (status === 'cancelled') {
    await purchaseService.cancelAfterPurchaseStock(id);
  }
  return new ApiResponse(200, invoice, 'Invoice status changed successfully').send(res);
});

export const getPurchasesReport = expressAsyncHandler(async (req, res) => {
  const filters = pick(req.query, [
    'status',
    'startDate',
    'endDate',
    'invoiceSearch',
    'staffName',
    'paymentMethod',
    'paymentStatus',
  ]);

  const { range } = req.query;

  filters.store = req.user.store;

  const now = new Date();

  let startDate;
  let endDate;

  if (req.query.startDate && req.query.endDate) {
    const rawStart = req.query.startDate;
    const rawEnd = req.query.endDate;

    startDate = new Date(/^\d+$/.test(rawStart) ? Number(rawStart) : rawStart);
    endDate = new Date(/^\d+$/.test(rawEnd) ? Number(rawEnd) : rawEnd);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format.',
      });
    }
  } else if (range === 'today') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (range === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    startDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
    endDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
  } else if (range === 'thisWeek') {
    const day = now.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);
    startDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 0, 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (range === 'thisMonth') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else if (range === 'previousMonth') {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  } else if (range === 'year') {
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  }

  if (startDate && endDate) {
    filters.startDate = startDate;
    filters.endDate = endDate;
  }

  const purchases = await purchaseService.queryPurchasesReport(filters);

  return new ApiResponse(200, purchases, 'Purchase report fetched successfully').send(res);
});

export const getVendorWisePurchaseReport = expressAsyncHandler(async (req, res) => {
  const filters = pick(req.query, ['startDate', 'endDate']);

  const { range } = req.query;

  console.log('reage ', req.query);

  filters.store = req.user.store;

  const now = new Date();

  let startDate;
  let endDate;

  // ✅ First priority: custom date range (accepts timestamp OR ISO string)
  if (req.query.startDate && req.query.endDate) {
    const rawStart = req.query.startDate;
    const rawEnd = req.query.endDate;

    startDate = new Date(/^\d+$/.test(rawStart) ? Number(rawStart) : rawStart);
    endDate = new Date(/^\d+$/.test(rawEnd) ? Number(rawEnd) : rawEnd);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format.',
      });
    }
  }

  // ✅ this month
  else if (range === 'thisMonth') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  // ✅ previous month
  else if (range === 'previousMonth') {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  }

  // ✅ current year
  else if (range === 'year') {
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  }

  // ✅ apply date filter
  if (startDate && endDate) {
    filters.startDate = startDate;
    filters.endDate = endDate;
  }

  console.log('start date', startDate);
  console.log('endDate', endDate);

  const result = await purchaseService.getVendorWisePurchaseReport(filters);

  return new ApiResponse(200, result, 'Vendor wise purchase report fetched successfully').send(res);
});
