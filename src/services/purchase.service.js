import mongoose from 'mongoose';
import { Purchase } from '../models/purchase.model.js';
import { findOrCreateVendor } from '../services/vendor.service.js';
import { handleDuplicateKeyError } from '../utils/dbErrorHandler.js';
import { updateStockAfterPurchase } from '../services/product.service.js';
import { createVendorPayment, getVendorPaymentsByPurchase } from './vendorPayment.service.js';
import { ApiError } from '../utils/responseHandler.js';

export const createPurchase = async (data) => {
  if (!data.items.length) {
    throw new ApiError(400, 'Invalid purchase items!', {
      source: 'body',
      field: 'items',
      message: 'Purchase must have at least one item',
    });
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    // find or create supplier
    const vendorId = await findOrCreateVendor(
      data.store,
      {
        _id: data.vendor,
        name: data.vendorName,
        mobile: data.vendorMobile,
        address: data.vendorAddress,
        city: data.vendorCity,
        state: data.vendorState,
        country: data.vendorCountry,
        postalCode: data.vendorPostalCode,
        gstNumber: data.vendorGstNumber,
        panNumber: data.vendorPanNumber,
      },
      session
    );
    data.vendor = vendorId;

    const purchase = new Purchase(data);
    await purchase.save(session ? { session } : undefined);

    await updateStockAfterPurchase(purchase, session);

    // If payment is partial, record the outgoing transaction
    if (purchase.paymentStatus === 'partial') {
      await createVendorPayment(
        {
          store: purchase.store,
          purchase: purchase._id,
          amount: purchase.amountPaid,
          paymentMethod: purchase.paymentMethod,
          note: purchase.paymentNote,
        },
        session
      );
    }

    await session.commitTransaction();
    return purchase;
  } catch (error) {
    await session.abortTransaction();
    handleDuplicateKeyError(error, Purchase);
  } finally {
    await session.endSession();
  }
};

export const getPurchaseById = async (id) => {
  const purchase = await Purchase.findById(id);
  if (!purchase) return null;

  const payments = await getVendorPaymentsByPurchase(id);
  return { ...purchase.toObject(), payments };
};

export const queryPurchases = async (filter = {}, options = {}) => {
  const { page = 1, limit = 20, sortBy = 'createdAt', order = 'desc' } = options;
  const sort = { [sortBy]: order === 'desc' ? -1 : 1 };

  const aggregate = Purchase.aggregate([{ $match: filter }, { $project: { items: 0 } }]);
  const paginationOptions = {
    page,
    limit,
    sort,
    lean: true,
    leanWithId: false,
  };
  return Purchase.aggregatePaginate(aggregate, paginationOptions);
};

export const addPaymentToPurchase = async (purchaseId, paymentData) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // Update purchase payment status
    const purchase = await Purchase.findById(purchaseId).select('-items').session(session);
    if (!purchase || purchase.paymentStatus === 'paid') {
      throw new ApiError(400, 'Invalid payment!', [
        { source: 'params', field: 'purchaseId', message: 'No due amount found!' },
      ]);
    }
    const payment = await createVendorPayment(
      {
        store: purchase.store,
        purchase: purchaseId,
        ...paymentData,
      },
      session
    );

    if (paymentData.amount > purchase.amountDue) {
      throw new ApiError(400, 'Invalid payment amount!', [
        { source: 'body', field: 'amount', message: 'Payment amount exceeds purchase grand total' },
      ]);
    }
    purchase.amountPaid += paymentData.amount;
    purchase.amountDue -= paymentData.amount;

    // Update payment status
    if (purchase.amountPaid >= Math.round(purchase.grandTotal)) {
      purchase.paymentStatus = 'paid';
    } else {
      purchase.paymentStatus = 'partial';
    }
    const updatedPurchase = await purchase.save(session ? { session } : undefined);
    await session.commitTransaction();
    return { updatedPurchase, payment };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

export const modifyDueAmount = async (purchaseId, amountPaid, amountDue) => {
  const paymentStatus = amountPaid === 0 ? 'unpaid' : amountDue === 0 ? 'paid' : 'partial';
  return Purchase.findByIdAndUpdate(purchaseId, { amountPaid, amountDue, paymentStatus }, { new: true });
};
