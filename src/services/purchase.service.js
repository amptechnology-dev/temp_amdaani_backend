import mongoose from 'mongoose';
import { Purchase } from '../models/purchase.model.js';
import { findOrCreateVendor } from '../services/vendor.service.js';
import { handleDuplicateKeyError } from '../utils/dbErrorHandler.js';
import { updateStockAfterPurchase } from '../services/product.service.js';
import { createVendorPayment, getVendorPaymentsByPurchase, updateVendorPayment } from './vendorPayment.service.js';
import { ApiError } from '../utils/responseHandler.js';
import { StockTransaction } from '../models/stockTransaction.model.js';
import { adjustProductStock } from '../services/product.service.js';
import { StockTransactionType } from '../config/constants.js';

export const createPurchase = async (data) => {
  if (!data.items.length) {
    throw new ApiError(400, 'Invalid purchase items!', {
      source: 'body',
      field: 'items',
      message: 'Purchase must have at least one item',
    });
  }

  // ✅ Resolve vendor BEFORE starting transaction (avoids write conflict)
  const vendorId = await findOrCreateVendor(data.store, {
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
  }); // no session here

  console.log('=> resolved vendorId:', vendorId);

  if (!vendorId) {
    throw new ApiError(400, 'Could not resolve vendor', {
      source: 'body',
      field: 'vendor',
      message: 'Vendor could not be found or created',
    });
  }

  // ✅ Retry wrapper for TransientTransactionError
  const MAX_RETRIES = 3;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
      });

      const purchasePayload = {
        ...data,
        vendor: vendorId,
      };

      const purchase = new Purchase(purchasePayload);
      await purchase.save({ session });

      await updateStockAfterPurchase(purchase, session);

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

      // ✅ Retry only on transient transaction errors
      const isTransient = error?.errorLabels?.includes('TransientTransactionError') || error?.code === 112;

      if (isTransient && attempt < MAX_RETRIES - 1) {
        attempt++;
        console.warn(`⚠️ TransientTransactionError, retrying... attempt ${attempt}`);
        await session.endSession();
        await new Promise((res) => setTimeout(res, 50 * attempt)); // backoff
        continue;
      }

      await session.endSession();
      console.error('❌ createPurchase error:', error.message);
      handleDuplicateKeyError(error, Purchase);
      throw error;
    } finally {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      session.endSession().catch(() => {});
    }
  }
};

const getItemStockReport = async () => {
  try {
  } catch (error) {}
};

export const updatePurchase = async (purchaseId, data) => {
  if (data.items && !data.items.length) {
    throw new ApiError(400, 'Invalid purchase items!', {
      source: 'body',
      field: 'items',
      message: 'Purchase must have at least one item',
    });
  }

  // ✅ Resolve vendor BEFORE starting transaction (avoids write conflict)
  const vendorId = await findOrCreateVendor(data.store, {
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
  }); // no session here

  console.log('=> resolved vendorId:', vendorId);

  if (!vendorId) {
    throw new ApiError(400, 'Could not resolve vendor', {
      source: 'body',
      field: 'vendor',
      message: 'Vendor could not be found or created',
    });
  }

  // ✅ Retry wrapper for TransientTransactionError
  const MAX_RETRIES = 3;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
      });

      // ✅ Fetch existing purchase inside transaction for snapshot consistency
      const existingPurchase = await Purchase.findOne({
        _id: purchaseId,
        store: data.store,
      }).session(session);

      if (!existingPurchase) {
        throw new ApiError(404, 'Purchase not found!', [
          { source: 'params', field: 'id', message: 'Purchase not found' },
        ]);
      }

      const purchasePayload = {
        ...data,
        vendor: vendorId,
      };

      // ✅ Reverse old stock before applying new stock
      await reverseStockAfterPurchase(existingPurchase, session);

      Object.assign(existingPurchase, purchasePayload);
      await existingPurchase.save({ session });

      // ✅ Apply updated stock
      await updateStockAfterPurchase(existingPurchase, session);

      // ✅ Handle partial payment update
      if (existingPurchase.paymentStatus === 'partial') {
        await updateVendorPayment(
          {
            store: existingPurchase.store,
            purchase: existingPurchase._id,
            amount: existingPurchase.amountPaid,
            paymentMethod: existingPurchase.paymentMethod,
            note: existingPurchase.paymentNote,
          },
          session
        );
      }

      await session.commitTransaction();
      return existingPurchase;
    } catch (error) {
      await session.abortTransaction();

      // ✅ Retry only on transient transaction errors
      const isTransient = error?.errorLabels?.includes('TransientTransactionError') || error?.code === 112;

      if (isTransient && attempt < MAX_RETRIES - 1) {
        attempt++;
        console.warn(`⚠️ TransientTransactionError, retrying... attempt ${attempt}`);
        await session.endSession();
        await new Promise((res) => setTimeout(res, 50 * attempt)); // backoff
        continue;
      }

      await session.endSession();
      console.error('❌ updatePurchase error:', error.message);
      handleDuplicateKeyError(error, Purchase);
      throw error;
    } finally {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      session.endSession().catch(() => {});
    }
  }
};

export const reverseStockAfterPurchase = async (purchase, session = null) => {
  const { items = [], date, _id: purchaseId } = purchase;
  if (!items.length) return;

  // ✅ Delete old stock transactions tied to this purchase
  await StockTransaction.deleteMany({ purchaseId }, { session });

  // ✅ Reverse each item by applying negative quantity
  for (const item of items) {
    await adjustProductStock(
      {
        productId: item.product,
        date: date || new Date(),
        transactionType: StockTransactionType.PURCHASE_REVERSE,
        quantity: -item.quantity, // 👈 negative to subtract stock
        rate: item.rate,
        batchId: item.batch,
        purchaseId,
        purchasePrice: item.rate,
        remarks: `Purchase reversed for ${item.quantity} units`,
        salePrice: item.sellingPrice,
        sellingDiscount: item.sellingDiscount,
      },
      session
    );
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
