import { Transaction } from '../models/transaction.model.js';

export const createTransaction = async (transactionData, session = null) => {
  const transaction = new Transaction(transactionData);
  return await transaction.save(session ? { session } : undefined);
};

export const getTransactionsByInvoice = async (invoiceId) => {
  return Transaction.find({ invoice: invoiceId }).sort({ createdAt: -1 });
};

export const updateTransactionStatus = async (transactionId, status) => {
  return Transaction.findByIdAndUpdate(transactionId, { status }, { new: true });
};

export const getTransactionsByStore = async (storeId, startDate, endDate) => {
  startDate = new Date(startDate);
  startDate.setHours(0, 0, 0, 0);
  endDate = new Date(endDate);
  endDate.setHours(23, 59, 59, 999);

  return Transaction.find({ store: storeId, createdAt: { $gte: startDate, $lte: endDate } })
    .populate('invoice', 'invoiceNumber')
    .sort({ createdAt: -1 });
};

export const cancelTransaction = async (transactionId) => {
  return Transaction.findByIdAndUpdate(transactionId, { status: 'cancelled' }, { new: true });
};

export const deleteTransaction = async (transactionId) => {
  return await Transaction.findByIdAndDelete(transactionId).populate('invoice', 'paymentStatus amountPaid amountDue');
};

export const cancelAllTransactionsForInvoice = async (invoiceId) => {
  return await Transaction.updateMany({ invoice: invoiceId }, { $set: { status: 'cancelled' } });
};
