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

  console.log('data--> form frontend', JSON.stringify(data));

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
        // ✅ remap item fields to match schema exactly
        items: data.items.map((item) => ({
          ...item,
          rate: Number(item.rate ?? item.costPrice ?? 0),
          costPrice: Number(item.costPrice ?? item.rate ?? 0),
          isPurchaseTaxInclusive: Boolean(item.isPurchaseTaxInclusive ?? false),
          isTaxInclusive: Boolean(item.isTaxInclusive ?? false),
          purchaseDiscount: Number(item.purchaseDiscount ?? 0),
          baseRate: Number(item.baseRate ?? 0),
          taxableValue: Number(item.taxableValue ?? 0),
          gstAmount: Number(item.gstAmount ?? 0),
        })),
      };

      const purchase = new Purchase(purchasePayload);
      await purchase.save({ session });

      await updateStockAfterPurchase(purchase, session);
      console.log('parches--->', JSON.stringify(purchase));
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
  console.log('data-->', JSON.stringify(data));
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

  console.log('=> updatePurchase payload:', JSON.stringify(data));

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

      console.log('=> existingPurchase:', JSON.stringify(existingPurchase));

      // Comment out old logic because of bug fixing
      await reverseStockAfterPurchase(data, session);
      // await reverseStockAfterPurchase(existingPurchase, session);

      Object.assign(existingPurchase, purchasePayload);
      await existingPurchase.save({ session });
      await updateStockAfterPurchase(data, session);

      // Object.assign(existingPurchase, purchasePayload);
      // await existingPurchase.save({ session });
      // await updateStockAfterPurchase(
      //   existingPurchase,
      //   session
      // );

      // ✅ Handle partial payment update

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

  console.log('reves => ', items);

  // ✅ Delete old stock transactions tied to this purchase
  await StockTransaction.deleteMany({ purchaseId, transactionType: StockTransactionType.PURCHASE }, { session });

  // ✅ Reverse each item by applying negative quantity
  for (const item of items) {
    await adjustProductStock(
      {
        productId: item.product,
        date: date || new Date(),
        transactionType: StockTransactionType.PURCHASE_REVERSE,
        quantity: item.previousQuantity <= item.quantity ? -item.previousQuantity : -item.previousQuantity, // 👈 negative to subtract stock
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

export const reverseStockAfterPurchaseDelete = async (purchase, session = null) => {
  const { items = [], date, _id: purchaseId } = purchase;
  if (!items.length) return;

  console.log('reves => ', items);

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

// export const deletePurchase = async (purchaseId, storeId) => {
//   const MAX_RETRIES = 3;
//   let attempt = 0;

//   while (attempt < MAX_RETRIES) {
//     const session = await mongoose.startSession();
//     try {
//       session.startTransaction({
//         readConcern: { level: 'snapshot' },
//         writeConcern: { w: 'majority' },
//       });

//       // Fetch inside transaction for snapshot consistency
//       const existingPurchase = await Purchase.findOne({
//         _id: purchaseId,
//         store: storeId,
//       }).session(session);

//       if (!existingPurchase) {
//         throw new ApiError(404, 'Purchase not found!', [
//           { source: 'params', field: 'id', message: 'Purchase not found' },
//         ]);
//       }

//       // Step 1: Reverse stock for every item in this purchase
//       await reverseStockAfterDelete(existingPurchase, session);

//       // Step 2: Reverse vendor payment ledger if any amount was paid
//       await updateVendorPayment(
//         {
//           store: existingPurchase.store,
//           purchase: existingPurchase._id,
//           amount: 0, // zero out the payment
//           paymentMethod: existingPurchase.paymentMethod,
//           note: 'Purchase deleted',
//         },
//         session
//       );

//       // Step 3: Hard delete the purchase document
//       await Purchase.deleteOne({ _id: purchaseId }, { session });

//       await session.commitTransaction();
//       return existingPurchase;
//     } catch (error) {
//       await session.abortTransaction();

//       const isTransient = error?.errorLabels?.includes('TransientTransactionError') || error?.code === 112;

//       if (isTransient && attempt < MAX_RETRIES - 1) {
//         attempt++;
//         console.warn(`⚠️ TransientTransactionError on delete, retrying... attempt ${attempt}`);
//         await session.endSession();
//         await new Promise((res) => setTimeout(res, 50 * attempt));
//         continue;
//       }

//       await session.endSession();
//       console.error('❌ deletePurchase error:', error.message);
//       throw error;
//     } finally {
//       if (session.inTransaction()) {
//         await session.abortTransaction();
//       }
//       session.endSession().catch(() => {});
//     }
//   }
// };

export const changePurchaseInvoiceStatus = async (invoiceId, status) => {
  return Purchase.findByIdAndUpdate(invoiceId, { status }, { new: true });
};

export const cancelAfterPurchaseStock = async (purchaseId) => {
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const session = await mongoose.startSession();
    session.startTransaction({
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
    });

    try {
      const existingPurchase = await Purchase.findOne({
        _id: purchaseId,
      }).session(session);

      if (!existingPurchase) {
        throw new Error(`Purchase not found: ${purchaseId}`);
      }

      // Step 1: Reverse stock
      await reverseStockAfterPurchaseDelete(existingPurchase, session); // ✅ fixed name

      // Step 2: Reverse vendor payment ledger
      await updateVendorPayment(
        {
          store: existingPurchase.store,
          purchase: existingPurchase._id,
          amount: 0,
          paymentMethod: existingPurchase.paymentMethod,
          note: 'Purchase deleted',
        },
        session
      );

      await session.commitTransaction(); // ✅ was missing entirely
      await session.endSession();

      return existingPurchase;
    } catch (error) {
      // Only abort if transaction is still active
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      await session.endSession(); // ✅ single, safe cleanup

      const isTransient = error?.errorLabels?.includes('TransientTransactionError') || error?.code === 112;

      if (isTransient && attempt < MAX_RETRIES - 1) {
        console.warn(`⚠️ TransientTransactionError on cancel, retrying... attempt ${attempt + 1}`);
        await new Promise((res) => setTimeout(res, 50 * (attempt + 1)));
        continue; // ✅ retry with a fresh session
      }

      console.error('❌ cancelAfterPurchaseStock error:', error.message);
      throw error;
    }
  }
};

export const queryPurchasesReport = async (filters = {}) => {
  const { store, startDate, endDate, status } = filters;

  // ── match stage ───────────────────────────────────────────────────────────
  const matchStage = {
    status: { $ne: 'cancelled' },
  };

  if (store) {
    matchStage.store = new mongoose.Types.ObjectId(String(store));
  }

  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    matchStage.date = { $gte: start, $lte: end };
  }

  if (status && status !== 'cancelled') {
    matchStage.status = status;
  }

  const result = await Purchase.aggregate([
    { $match: matchStage },

    // ── store lookup ──────────────────────────────────────────────────────
    {
      $lookup: {
        from: 'stores',
        localField: 'store',
        foreignField: '_id',
        as: 'storeInfo',
      },
    },
    { $unwind: { path: '$storeInfo', preserveNullAndEmptyArrays: true } },

    // ── STEP 1: per-item calculations ─────────────────────────────────────
    {
      $addFields: {
        calcItems: {
          $map: {
            input: '$items',
            as: 'it',
            in: {
              $let: {
                vars: {
                  qty:      { $toDouble: { $ifNull: ['$$it.quantity', 0] } },
                  rawRate:  { $toDouble: { $ifNull: ['$$it.rate', 0] } },
                  gstRate:  { $toDouble: { $ifNull: ['$$it.gstRate', 0] } },
                  isIncl:   { $ifNull: ['$$it.isTaxInclusive', false] },
                  discAmt:  { $toDouble: { $ifNull: ['$$it.purchaseDiscount', 0] } },
                  discType: { $ifNull: ['$$it.purchaseDiscountType', 'amount'] },
                },
                in: {
                  $let: {
                    vars: {
                      // ── rawDiscPerUnit ────────────────────────────────
                      // percentage → rate × disc% ÷ 100
                      // amount     → purchaseDiscount (flat ₹ per unit)
                      rawDiscPerUnit: {
                        $cond: [
                          { $eq: ['$$discType', 'percentage'] },
                          {
                            $multiply: [
                              '$$rawRate',
                              { $divide: ['$$discAmt', 100] },
                            ],
                          },
                          '$$discAmt',
                        ],
                      },

                      // divisor = 1 + gstRate/100  (for inclusive GST strip)
                      divisor: { $add: [1, { $divide: ['$$gstRate', 100] }] },
                    },
                    in: {
                      $let: {
                        vars: {
                          // ── baseRate ──────────────────────────────────
                          // inclusive → rawRate / divisor  (ex-GST rate)
                          // exclusive → rawRate
                          baseRate: {
                            $cond: [
                              { $and: ['$$isIncl', { $gt: ['$$gstRate', 0] }] },
                              { $divide: ['$$rawRate', '$$divisor'] },
                              '$$rawRate',
                            ],
                          },

                          // ── discExcl ──────────────────────────────────
                          // Strip GST from per-unit discount when inclusive
                          // inclusive → rawDiscPerUnit / divisor
                          // exclusive → rawDiscPerUnit
                          discExcl: {
                            $cond: [
                              { $and: ['$$isIncl', { $gt: ['$$gstRate', 0] }] },
                              { $divide: ['$$rawDiscPerUnit', '$$divisor'] },
                              '$$rawDiscPerUnit',
                            ],
                          },

                          // ── netAmt = (rawRate - rawDiscPerUnit) × qty ─
                          // For inclusive: GST already baked in → final payable
                          // For gstRate=0: no GST → final payable
                          netAmt: {
                            $max: [
                              0,
                              {
                                $multiply: [
                                  {
                                    $subtract: ['$$rawRate', '$$rawDiscPerUnit'],
                                  },
                                  '$$qty',
                                ],
                              },
                            ],
                          },
                        },
                        in: {
                          $let: {
                            vars: {
                              // ── taxableValue ──────────────────────────
                              // gstRate = 0  → 0  (nothing taxable)
                              // exclusive    → (baseRate - discExcl) × qty
                              // inclusive    → (baseRate - discExcl) × qty
                              //                (= netAmt / divisor)
                              taxableValue: {
                                $cond: [
                                  { $eq: ['$$gstRate', 0] },
                                  0,
                                  {
                                    $max: [
                                      0,
                                      {
                                        $multiply: [
                                          { $subtract: ['$$baseRate', '$$discExcl'] },
                                          '$$qty',
                                        ],
                                      },
                                    ],
                                  },
                                ],
                              },
                            },
                            in: {
                              qty:     '$$qty',
                              gstRate: '$$gstRate',

                              // rawDiscAmt: the actual ₹ discount deducted (per invoice line)
                              // = rawDiscPerUnit × qty  (RAW, no GST strip)
                              // This is what shows as "Discount" on the purchase bill
                              rawDiscAmt: {
                                $round: [{ $multiply: ['$$rawDiscPerUnit', '$$qty'] }, 2],
                              },

                              taxableValue: { $round: ['$$taxableValue', 2] },

                              // gstAmount = taxableValue × gstRate%
                              gstAmount: {
                                $round: [
                                  {
                                    $multiply: [
                                      '$$taxableValue',
                                      { $divide: ['$$gstRate', 100] },
                                    ],
                                  },
                                  2,
                                ],
                              },

                              // ── itemTotal ─────────────────────────────
                              // gstRate = 0  → netAmt
                              // inclusive    → netAmt  (GST inside)
                              // exclusive    → taxableValue + gstAmount
                              itemTotal: {
                                $round: [
                                  {
                                    $cond: [
                                      { $eq: ['$$gstRate', 0] },
                                      '$$netAmt',
                                      {
                                        $cond: [
                                          '$$isIncl',
                                          '$$netAmt',
                                          {
                                            $add: [
                                              '$$taxableValue',
                                              {
                                                $multiply: [
                                                  '$$taxableValue',
                                                  { $divide: ['$$gstRate', 100] },
                                                ],
                                              },
                                            ],
                                          },
                                        ],
                                      },
                                    ],
                                  },
                                  2,
                                ],
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ── STEP 2: invoice-level totals ──────────────────────────────────────
    {
      $addFields: {
        totalItemsQty: { $sum: '$calcItems.qty' },

        // Σ rawDiscAmt — actual ₹ discounts deducted across all items
        discountTotal: {
          $round: [{ $sum: '$calcItems.rawDiscAmt' }, 2],
        },

        taxableValue: {
          $round: [{ $sum: '$calcItems.taxableValue' }, 2],
        },

        gstTotal: {
          $round: [{ $sum: '$calcItems.gstAmount' }, 2],
        },

        // netAmount = Σ itemTotal  (grand total before roundOff)
        netAmount: {
          $round: [{ $sum: '$calcItems.itemTotal' }, 2],
        },
      },
    },

    // ── STEP 3: subTotal = netAmount − gstTotal ───────────────────────────
    {
      $addFields: {
        subTotal: {
          $round: [{ $subtract: ['$netAmount', '$gstTotal'] }, 2],
        },
      },
    },

    // ── STEP 4: CGST / SGST / IGST split ─────────────────────────────────
    {
      $addFields: {
        cgstTotal: {
          $round: [
            { $cond: [{ $eq: ['$isIgst', true] }, 0, { $divide: ['$gstTotal', 2] }] },
            2,
          ],
        },
        sgstTotal: {
          $round: [
            { $cond: [{ $eq: ['$isIgst', true] }, 0, { $divide: ['$gstTotal', 2] }] },
            2,
          ],
        },
        igstTotal: {
          $round: [
            { $cond: [{ $eq: ['$isIgst', true] }, '$gstTotal', 0] },
            2,
          ],
        },
      },
    },

    // ── STEP 5: clean up helper arrays ────────────────────────────────────
    { $project: { calcItems: 0, items: 0 } },

    { $sort: { date: -1 } },
  ]);

  return result;
};

export const getVendorWisePurchaseReport = async (filters = {}) => {
  const { store, startDate, endDate } = filters;

  const matchStage = {
    status: {
      $ne: 'cancelled',
    },

    paymentStatus: {
      $in: ['partial', 'unpaid'],
    },
  };

  if (store) {
    matchStage.store = new mongoose.Types.ObjectId(String(store));
  }

  if (startDate && endDate) {
    matchStage.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  return Purchase.aggregate([
    {
      $match: matchStage,
    },

    // Vendor Details
    {
      $lookup: {
        from: 'vendors',
        localField: 'vendor',
        foreignField: '_id',
        as: 'vendor',
      },
    },

    {
      $unwind: {
        path: '$vendor',
        preserveNullAndEmptyArrays: true,
      },
    },

    // Vendor Wise Group
    {
      $group: {
        _id: '$vendor._id',

        vendorName: {
          $first: '$vendor.name',
        },

        vendorMobile: {
          $first: '$vendor.mobile',
        },

        vendorGstNumber: {
          $first: '$vendor.gstNumber',
        },

        totalPurchaseAmount: {
          $sum: '$grandTotal',
        },

        totalPaidAmount: {
          $sum: '$amountPaid',
        },

        totalDueAmount: {
          $sum: '$amountDue',
        },

        totalInvoices: {
          $sum: 1,
        },

        invoices: {
          $push: {
            purchaseId: '$_id',

            invoiceNo: '$invoiceNumber',

            date: '$date',

            grandTotal: '$grandTotal',

            amountPaid: '$amountPaid',

            amountDue: '$amountDue',

            paymentStatus: '$paymentStatus',

            status: '$status',
          },
        },
      },
    },

    {
      $sort: {
        vendorName: 1,
      },
    },
  ]);
};
