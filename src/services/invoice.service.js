import { Invoice } from '../models/invoice.model.js';
import { findOrCreateProduct } from '../services/product.service.js';
import { findOrCreateCustomer } from '../services/customer.service.js';
import { ApiError } from '../utils/responseHandler.js';
import mongoose from 'mongoose';
import { handleDuplicateKeyError } from '../utils/dbErrorHandler.js';
import { createTransaction, getTransactionsByInvoice } from './transaction.service.js';
import { updateStockAfterSale } from './product.service.js';

//NOTE: Trusting frontend for valid data
export const createInvoice = async (data) => {
  const { items = [] } = data;
  if (!items.length) {
    throw new ApiError(400, 'Invalid invoice items!', {
      source: 'body',
      field: 'items',
      message: 'Invoice must have at least one item',
    });
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const invoiceItems = [];
    for (const item of items) {
      const productId = await findOrCreateProduct(data.store, item, session);
      invoiceItems.push({
        product: productId,
        ...item,
      });
    }

    const customerId = await findOrCreateCustomer(
      data.store,
      {
        _id: data.customer,
        name: data.customerName,
        mobile: data.customerMobile,
        address: data.customerAddress,
        city: data.customerCity,
        state: data.customerState,
        country: data.customerCountry,
        postalCode: data.customerPostalCode,
        gstNumber: data.customerGstNumber,
      },
      session
    );
    data.items = invoiceItems;
    data.customer = customerId;
    const invoice = new Invoice(data);
    await invoice.save(session ? { session } : undefined);
    // If payment status is partial, create a transaction
    if (invoice.paymentStatus === 'partial') {
      await createTransaction(
        {
          store: invoice.store,
          invoice: invoice._id,
          amount: invoice.amountPaid,
          paymentMethod: invoice.paymentMethod,
          note: invoice.paymentNote,
        },
        session
      );
    }
    await updateStockAfterSale(invoice, session);
    await session.commitTransaction();
    return invoice;
  } catch (error) {
    await session.abortTransaction();
    handleDuplicateKeyError(error, Invoice);
  } finally {
    await session.endSession();
  }
};

export const updateInvoice = async (invoiceId, data) => {
  const { items = [] } = data;

  if (!items.length) {
    throw new ApiError(400, 'Invalid invoice items!', {
      source: 'body',
      field: 'items',
      message: 'Invoice must have at least one item',
    });
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // Find the invoice first
    const invoice = await Invoice.findById(invoiceId).session(session);
    if (!invoice) throw new ApiError(404, 'Invoice not found');

    // --- Step 1: Update or re-link products ---
    const invoiceItems = [];
    for (const item of items) {
      const productId = await findOrCreateProduct(invoice.store, item, session);
      invoiceItems.push({
        product: productId,
        ...item,
      });
    }

    // --- Step 2: Update or re-link customer ---
    const customerId = await findOrCreateCustomer(
      invoice.store,
      {
        _id: data.customer,
        name: data.customerName,
        mobile: data.customerMobile,
        address: data.customerAddress,
        city: data.customerCity,
        state: data.customerState,
        country: data.customerCountry,
        postalCode: data.customerPostalCode,
        gstNumber: data.customerGstNumber,
      },
      session
    );

    // --- Step 3: Update invoice fields ---
    invoice.set({
      ...data,
      items: invoiceItems,
      customer: customerId,
      edited: true,
    });

    await invoice.save({ session });
    await session.commitTransaction();

    return invoice;
  } catch (error) {
    await session.abortTransaction();
    handleDuplicateKeyError(error, Invoice);
  } finally {
    await session.endSession();
  }
};

export const getInvoiceById = async (id) => {
  const invoice = await Invoice.findById(id).populate('customer');
  if (!invoice) return null;

  const transactions = await getTransactionsByInvoice(id);
  return { ...invoice.toObject(), transactions };
};

export const queryInvoices = async (filter = {}, options = {}) => {
  const { page = 1, limit = 20, sortBy = 'createdAt', order = 'desc' } = options;
  const sort = { [sortBy]: order === 'desc' ? -1 : 1 };

  const aggregate = Invoice.aggregate([{ $match: filter }, { $project: { items: 0 } }]);
  const paginationOptions = {
    page,
    limit,
    sort,
    lean: true,
    leanWithId: false,
  };
  return Invoice.aggregatePaginate(aggregate, paginationOptions);
};

export const getLastInvoice = async (store) => {
  return Invoice.findOne({ store }).sort({ createdAt: -1 });
};

export const getProductWiseInvoices = async (filters = {}) => {
  const { store, startDate, endDate } = filters;

  const matchStage = {};
  if (store) matchStage.store = store;
  if (startDate && endDate) {
    matchStage.invoiceDate = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const result = await Invoice.aggregate([
    { $match: matchStage },
    { $unwind: '$items' },
    {
      $project: {
        date: '$invoiceDate',
        invoiceNumber: 1,
        product: '$items.name',
        productHsn: '$items.hsn',
        unit: '$items.unit',
        price: '$items.sellingPrice',
        quantity: '$items.quantity',
        discount: '$items.discount',
        gstRate: '$items.gstRate',
        gstAmount: {
          $round: [{ $multiply: ['$items.total', { $divide: ['$items.gstRate', 100] }] }, 2],
        },
        lineTotal: '$items.total',
        grandTotal: '$grandTotal',
      },
    },
    { $sort: { date: 1, invoiceNumber: 1 } },
  ]);
  return result;
};

export const addPaymentToInvoice = async (invoiceId, paymentData) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // Update invoice payment status
    const invoice = await Invoice.findById(invoiceId).select('-items').session(session);
    if (invoice.paymentStatus === 'paid') {
      throw new ApiError(400, 'Invalid payment!', [
        { source: 'body', field: 'payment', message: 'Invoice already paid' },
      ]);
    }
    const transaction = await createTransaction(
      {
        store: invoice.store,
        invoice: invoiceId,
        ...paymentData,
      },
      session
    );

    if (invoice.amountPaid + paymentData.amount > Math.round(invoice.grandTotal)) {
      throw new ApiError(400, 'Invalid payment amount!', [
        { source: 'body', field: 'amount', message: 'Payment amount exceeds invoice grand total' },
      ]);
    }
    invoice.amountPaid += paymentData.amount;
    invoice.amountDue -= paymentData.amount;

    // Update payment status
    if (invoice.amountPaid >= Math.round(invoice.grandTotal)) {
      invoice.paymentStatus = 'paid';
    } else {
      invoice.paymentStatus = 'partial';
    }
    const updatedInvoice = await invoice.save(session ? { session } : undefined);
    await session.commitTransaction();
    return { updatedInvoice, transaction };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

export const changeInvoiceStatus = async (invoiceId, status) => {
  return Invoice.findByIdAndUpdate(invoiceId, { status }, { new: true });
};

export const modifyDueAmount = async (invoiceId, amountPaid, amountDue) => {
  const paymentStatus = amountPaid === 0 ? 'unpaid' : amountDue === 0 ? 'paid' : 'partial';
  return Invoice.findByIdAndUpdate(invoiceId, { amountPaid, amountDue, paymentStatus }, { new: true });
};
