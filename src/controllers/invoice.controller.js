import expressAsyncHandler from 'express-async-handler';
import * as invoiceService from '../services/invoice.service.js';
import { ApiResponse, ApiError } from '../utils/responseHandler.js';
import pick from '../utils/pick.js';
import { updateUsage } from '../services/usage.service.js';
import * as transactionService from '../services/transaction.service.js';
import { deleteTransaction, cancelAllTransactionsForInvoice } from '../services/transaction.service.js';
import ExcelJS from "exceljs";

export const createInvoice = expressAsyncHandler(async (req, res) => {
  req.body.store = req.user.store;
  const invoice = await invoiceService.createInvoice(req.body);
  if (req.subscription) {
    await updateUsage(req.subscription._id, { $inc: { invoicesUsed: 1 } });
  }
  return new ApiResponse(201, invoice, "Invoice created successfully").send(res);
});

export const updateInvoice = expressAsyncHandler(async (req, res) => {
  const invoice = await invoiceService.updateInvoice(req.params.id, req.body);
  if (!invoice) {
    throw new ApiError(404, 'Invoice not found!', [{ source: 'params', field: 'id', message: 'Invoice not found' }]);
  }
  return new ApiResponse(200, invoice, 'Invoice updated successfully').send(res);
});
export const getInvoiceById = expressAsyncHandler(async (req, res) => {
  const invoice = await invoiceService.getInvoiceById(req.params.id);
  if (!invoice) {
    throw new ApiError(404, 'Invoice not found!', [{ source: 'params', field: 'id', message: 'Invoice not found' }]);
  }
  return new ApiResponse(200, invoice, 'Invoice fetched successfully').send(res);
});
export const getInvoices = expressAsyncHandler(async (req, res) => {
  const filters = pick(req.query, ['status']);
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'order']);
  const { range } = req.query;

  filters.store = req.user.store;

  const now = new Date();
  let startDate;
  let endDate;

  if (range === 'thisMonth') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }

  if (range === 'previousMonth') {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  }

  if (range === 'year') {
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  }

  if (startDate && endDate) {
    filters.createdAt = {
      $gte: startDate,
      $lte: endDate,
    };
  }

  const invoices = await invoiceService.queryInvoices(filters, options);

  return new ApiResponse(200, invoices, 'Invoices fetched successfully').send(res);
});
export const getLastInvoice = expressAsyncHandler(async (req, res) => {
  const invoice = await invoiceService.getLastInvoice(req.user.store);
  return new ApiResponse(200, invoice, 'Last invoice fetched successfully').send(res);
});

export const getProductWiseInvoices = expressAsyncHandler(async (req, res) => {
  const filters = pick(req.query, ['startDate', 'endDate']);
  const { range } = req.query;

  const now = new Date();
  let startDate;
  let endDate;

  if (range === 'thisMonth') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }

  if (range === 'previousMonth') {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  }

  if (range === 'year') {
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  }

  if (startDate && endDate) {
    filters.startDate = startDate;
    filters.endDate = endDate;
  }

  const invoice = await invoiceService.getProductWiseInvoices({
    ...filters,
    store: req.user.store,
  });

  return new ApiResponse(200, invoice, 'Product wise invoices fetched successfully').send(res);
});
export const getGstSalesReport = expressAsyncHandler(async (req, res) => {
  const filters = pick(req.query, ['startDate', 'endDate']);
  const { range } = req.query;

  const now = new Date();
  let startDate;
  let endDate;

  if (range === 'thisMonth') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }

  if (range === 'previousMonth') {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  }

  if (range === 'year') {
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  }

  if (startDate && endDate) {
    filters.startDate = startDate;
    filters.endDate = endDate;
  }

  const report = await invoiceService.getGstSalesReport({
    ...filters,
    store: req.user.store,
  });

  return new ApiResponse(200, report, 'GST sales report fetched successfully').send(res);
});

export const exportGstSalesReportExcel = expressAsyncHandler(async (req, res) => {
  const filters = {
    store: req.user.store,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
  };

  const report = await invoiceService.getGstSalesReport(filters);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("GST Sales Report");

  // Header
  worksheet.columns = [
    { header: "Invoice Date", key: "invoiceDate", width: 15 },
    { header: "Invoice No", key: "invoiceNumber", width: 15 },
    { header: "Customer Name", key: "customerName", width: 25 },
    { header: "Customer GST", key: "customerGst", width: 20 },
    { header: "Item", key: "item", width: 25 },
    { header: "HSN", key: "hsn", width: 15 },
    { header: "Unit", key: "unit", width: 10 },
    { header: "Quantity", key: "quantity", width: 10 },
    { header: "Taxable Value", key: "taxableValue", width: 15 },
    { header: "CGST %", key: "cgstPercent", width: 10 },
    { header: "CGST Amount", key: "cgstAmount", width: 15 },
    { header: "SGST %", key: "sgstPercent", width: 10 },
    { header: "SGST Amount", key: "sgstAmount", width: 15 },
    { header: "Invoice Amount", key: "invoiceAmount", width: 15 },
  ];

  // Add Rows
  report.forEach((item) => {
    worksheet.addRow(item);
  });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );

  res.setHeader(
    "Content-Disposition",
    "attachment; filename=gst-sales-report.xlsx"
  );

  await workbook.xlsx.write(res);
  res.end();
});

export const getGstPurchaseReport = expressAsyncHandler(async (req, res) => {
  const filters = pick(req.query, ['startDate', 'endDate']);
  const { range } = req.query;

  const now = new Date();
  let startDate;
  let endDate;

  if (range === 'thisMonth') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }

  if (range === 'previousMonth') {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  }

  if (range === 'year') {
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  }

  if (startDate && endDate) {
    filters.startDate = startDate;
    filters.endDate = endDate;
  }

  const report = await invoiceService.getGstPurchaseReport({
    ...filters,
    store: req.user.store,
  });

  return new ApiResponse(200, report, 'GST purchase report fetched successfully').send(res);
});

export const exportGstPurchaseReportExcel = expressAsyncHandler(async (req, res) => {
  const filters = pick(req.query, ["startDate", "endDate"]);
  const { range } = req.query;

  const now = new Date();
  let startDate;
  let endDate;

  if (range === "thisMonth") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }

  if (range === "previousMonth") {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  }

  if (range === "year") {
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  }

  if (startDate && endDate) {
    filters.startDate = startDate;
    filters.endDate = endDate;
  }

  const report = await invoiceService.getGstPurchaseReport({
    ...filters,
    store: req.user.store,
  });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("GST Purchase Report");

  // Header columns
  worksheet.columns = [
    { header: "Invoice Date", key: "invoiceDate", width: 15 },
    { header: "Invoice No", key: "invoiceNumber", width: 15 },
    { header: "Supplier Name", key: "supplierName", width: 25 },
    { header: "Supplier GST", key: "supplierGst", width: 20 },
    { header: "Item", key: "item", width: 25 },
    { header: "HSN", key: "hsn", width: 15 },
    { header: "Unit", key: "unit", width: 10 },
    { header: "Quantity", key: "quantity", width: 10 },
    { header: "Taxable Value", key: "taxableValue", width: 15 },
    { header: "CGST %", key: "cgstPercent", width: 10 },
    { header: "CGST Amount", key: "cgstAmount", width: 15 },
    { header: "SGST %", key: "sgstPercent", width: 10 },
    { header: "SGST Amount", key: "sgstAmount", width: 15 },
    { header: "Invoice Amount", key: "invoiceAmount", width: 15 },
  ];

  // Style header
  worksheet.getRow(1).font = { bold: true };

  // Add rows
  report.forEach((item) => {
    worksheet.addRow(item);
  });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );

  res.setHeader(
    "Content-Disposition",
    "attachment; filename=gst-purchase-report.xlsx"
  );

  await workbook.xlsx.write(res);
  res.end();
});

export const getProfitLossReport = expressAsyncHandler(async (req, res) => {
  const filters = pick(req.query, ['startDate', 'endDate']);
  const { range } = req.query;

  const now = new Date();
  let startDate;
  let endDate;

  if (range === 'thisMonth') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }

  if (range === 'previousMonth') {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  }

  if (range === 'year') {
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  }

  if (startDate && endDate) {
    filters.startDate = startDate;
    filters.endDate = endDate;
  }

  const report = await invoiceService.getProfitLossReport({
    ...filters,
    store: req.user.store,
  });

  return new ApiResponse(200, report, 'Profit loss report fetched successfully').send(res);
});

export const getItemStockReport = expressAsyncHandler(async (req, res) => {
  const { itemName, asOnDate } = req.query;

  const report = await purchaseService.getItemStockReport({
    store: req.user.store,
    itemName,
    asOnDate,
  });

  return new ApiResponse(200, report, 'Item stock report fetched successfully').send(res);
});

export const addPayment = expressAsyncHandler(async (req, res) => {
  const { invoiceId } = req.params;
  const invoice = await invoiceService.addPaymentToInvoice(invoiceId, req.body);
  return new ApiResponse(200, invoice, 'Payment added successfully').send(res);
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
export const getTransactionsByStore = expressAsyncHandler(async (req, res) => {
  const startDate = new Date(req.query.startDate);
  const endDate = new Date(req.query.endDate || new Date());

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new ApiError(400, 'Invalid date range!');
  }
  const transactions = await transactionService.getTransactionsByStore(req.user.store, startDate, endDate);
  return new ApiResponse(200, transactions, 'Transactions fetched successfully').send(res);
});
export const removePaymentFromInvoice = expressAsyncHandler(async (req, res) => {
  const { paymentId } = req.params;
  const payment = await deleteTransaction(paymentId);
  if (!payment) {
    throw new ApiError(404, 'Payment not found!', [
      { source: 'params', field: 'paymentId', message: 'Payment not found' },
    ]);
  }
  // Calculate and update due and status in invoice
  const amountPaid = payment.invoice.amountPaid - payment.amount;
  const amountDue = payment.invoice.amountDue + payment.amount;

  const updatedInvoice = await invoiceService.modifyDueAmount(payment.invoice, amountPaid, amountDue);
  return new ApiResponse(200, updatedInvoice, 'Payment removed successfully').send(res);
});
