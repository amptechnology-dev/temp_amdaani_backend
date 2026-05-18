import { Invoice } from '../models/invoice.model.js';
import { findOrCreateProduct } from '../services/product.service.js';
import { findOrCreateCustomer } from '../services/customer.service.js';
import { ApiError } from '../utils/responseHandler.js';
import mongoose from 'mongoose';
import { handleDuplicateKeyError } from '../utils/dbErrorHandler.js';
import { createTransaction, getTransactionsByInvoice } from './transaction.service.js';
import { updateStockAfterSale, reverseStockAfterSale } from './product.service.js';
import { Product } from '../models/product.model.js';
import { Purchase } from '../models/purchase.model.js';
import { StockTransaction } from '../models/stockTransaction.model.js';
import { Expense } from '../models/expense.model.js';
import { Store } from '../models/store.model.js';
import { json } from 'express';

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

  const store = await Store.findById(data.store);
  if (!store) {
    throw new ApiError(404, 'Store not found!', {
      source: 'body',
      field: 'store',
      message: 'Store data not found',
    });
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // Build invoice items
    const invoiceItems = [];
    for (const item of items) {
      const productId = await findOrCreateProduct(data.store, item, session);
      invoiceItems.push({
        ...item,
        // ✅ Only attach product ref if one exists — don't force it
        ...(productId ? { product: productId } : {}),
      });
    }

    console.log('Invoice Items:', JSON.stringify(invoiceItems));

    // Handle customer
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

    // Build full invoice doc WITH store snapshot — all in one shot
    const invoiceDoc = {
      ...data,
      items: invoiceItems,
      customer: customerId,

      // Store snapshot embedded at creation time
      name: store.name,
      tagline: store.tagline,
      ownershipType: store.ownershipType,
      gstNumber: store.gstNumber,
      panNumber: store.panNumber,
      registrationNo: store.registrationNo,
      contactNo: store.contactNo,
      email: store.email,
      address: {
        street: store.address?.street,
        city: store.address?.city,
        state: store.address?.state,
        country: store.address?.country || 'IN',
        postalCode: store.address?.postalCode,
      },
      bankDetails: {
        bankName: store.bankDetails?.bankName,
        accountNo: store.bankDetails?.accountNo,
        holderName: store.bankDetails?.holderName,
        ifsc: store.bankDetails?.ifsc,
        branch: store.bankDetails?.branch,
        upiId: store.bankDetails?.upiId,
      },
      settings: {
        invoicePrefix: data.settings?.invoicePrefix || store.settings?.invoicePrefix || 'INV',

        invoiceStartNumber: data.settings?.invoiceStartNumber || store.settings?.invoiceStartNumber || 1,

        taxRates: data.settings?.taxRates || store.settings?.taxRates || [],

        invoiceTerms: data.settings?.invoiceTerms || store.settings?.invoiceTerms,

        stockManagement: data.settings?.stockManagement ?? store.settings?.stockManagement ?? false,

        purchaseOrderManagement:
          data.settings?.purchaseOrderManagement ?? store.settings?.purchaseOrderManagement ?? false,
      },
      logoUrl: store.logoUrl,
      signatureUrl: store.signatureUrl,
      isActive: store.isActive,
    };

    const invoice = new Invoice(invoiceDoc);
    await invoice.save({ session }); // ✅ correct syntax

    // Create transaction if partial payment

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

    await updateStockAfterSale(invoice, session);

    await session.commitTransaction(); // ✅ everything commits together
    return invoice;
  } catch (error) {
    await session.abortTransaction();
    throw handleDuplicateKeyError(error) || error; // ✅ always throws
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

    // Find the existing invoice
    const invoice = await Invoice.findById(invoiceId).session(session);
    if (!invoice) throw new ApiError(404, 'Invoice not found');

    // --- Step 1: Build invoice items exactly like createInvoice ---
    const invoiceItems = [];
    for (const item of items) {
      const productId = await findOrCreateProduct(invoice.store, item, session);
      invoiceItems.push({
        ...item,
        ...(productId ? { product: productId } : {}),
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

    // --- Step 3: Reverse old stock transactions ---
    await reverseStockAfterSale(invoice, session);

    // --- Step 4: Update invoice fields ---
    invoice.set({
      ...data,
      items: invoiceItems,
      customer: customerId,
      edited: true,
    });

    await invoice.save({ session });

    // --- Step 5: Apply new stock based on updated invoice ---
    await updateStockAfterSale(invoice, session);

    await session.commitTransaction();
    return invoice;
  } catch (error) {
    await session.abortTransaction();
    throw handleDuplicateKeyError(error) || error;
  } finally {
    await session.endSession();
  }
};

export const getInvoiceById = async (id) => {
  const result = await Invoice.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(id),
      },
    },
    {
      $lookup: {
        from: 'customers',
        localField: 'customer',
        foreignField: '_id',
        as: 'customerDetails',
        pipeline: [
          {
            $project: {
              name: 1,
              mobile: 1,
              address: 1,
              gstNumber: 1,
              city: 1,
              state: 1,
              country: 1,
              postalCode: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: {
        path: '$customerDetails',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'products',
        localField: 'items.product',
        foreignField: '_id',
        as: 'productDetails',
        pipeline: [
          {
            $project: {
              name: 1,
              hsn: 1,
              unit: 1,
              sellingPrice: 1,
              gstRate: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: 'transactions',
        localField: '_id',
        foreignField: 'invoice',
        as: 'transactions',
        pipeline: [
          {
            $sort: { createdAt: -1 },
          },
          {
            $project: {
              amount: 1,
              paymentMethod: 1,
              note: 1,
              type: 1,
              createdAt: 1,
            },
          },
        ],
      },
    },
    {
      $project: {
        store: 1,
        invoiceNumber: 1,
        invoiceDate: 1,
        type: 1,
        status: 1,
        edited: 1,
        remarks: 1,
        customer: 1,
        customerName: 1,
        customerMobile: 1,
        customerAddress: 1,
        customerGstNumber: 1,
        customerCity: 1,
        customerState: 1,
        customerCountry: 1,
        customerPostalCode: 1,
        customerDetails: 1,
        items: 1,
        productDetails: 1,
        subTotal: 1,
        gstTotal: 1,
        isIgst: 1,
        discountTotal: 1,
        roundOff: 1,
        grandTotal: 1,
        paymentStatus: 1,
        amountPaid: 1,
        amountDue: 1,
        paymentMethod: 1,
        paymentNote: 1,
        transactions: 1,
        name: 1,
        tagline: 1,
        ownershipType: 1,
        gstNumber: 1,
        panNumber: 1,
        registrationNo: 1,
        contactNo: 1,
        email: 1,
        address: 1,
        bankDetails: 1,
        settings: 1,
        logoUrl: 1,
        signatureUrl: 1,
        isActive: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ]);

  // ✅ aggregate returns an array — return first element or null
  return result[0] || null;
};

export const queryInvoices = async (filter = {}, options = {}) => {
  const { page = 1, limit = 20, sortBy = 'createdAt', order = 'desc' } = options;

  const aggregate = Invoice.aggregate([
    {
      $match: filter,
    },
    {
      $lookup: {
        from: 'stores',
        localField: 'store',
        foreignField: '_id',
        as: 'store',
        pipeline: [
          {
            $project: {
              name: 1,
              type: 1,
              gstNumber: 1,
              contactNo: 1,
              email: 1,
              address: 1,
              logoUrl: 1,
              signatureUrl: 1,
              bankDetails: 1,
              settings: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: {
        path: '$store',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        items: 0,
      },
    },
    {
      $sort: {
        [sortBy]: order === 'desc' ? -1 : 1,
      },
    },
  ]);

  const paginationOptions = {
    page: Number(page),
    limit: Number(limit),
    lean: true,
    leanWithId: false,
  };

  return Invoice.aggregatePaginate(aggregate, paginationOptions);
};

export const getLastInvoice = async (store) => {
  const result = await Invoice.aggregate([
    {
      $match: {
        store: new mongoose.Types.ObjectId(store),
      },
    },
    {
      $sort: { createdAt: -1 },
    },
    {
      $limit: 1,
    },
    {
      $lookup: {
        from: 'customers',
        localField: 'customer',
        foreignField: '_id',
        as: 'customerDetails',
        pipeline: [
          {
            $project: {
              name: 1,
              mobile: 1,
              address: 1,
              gstNumber: 1,
              city: 1,
              state: 1,
              country: 1,
              postalCode: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: {
        path: '$customerDetails',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'products',
        localField: 'items.product',
        foreignField: '_id',
        as: 'productDetails',
        pipeline: [
          {
            $project: {
              name: 1,
              hsn: 1,
              unit: 1,
              sellingPrice: 1,
              gstRate: 1,
            },
          },
        ],
      },
    },
    {
      $project: {
        // ── Invoice core ──────────────────────────────────
        store: 1,
        invoiceNumber: 1,
        invoiceDate: 1,
        type: 1,
        status: 1,
        edited: 1,
        remarks: 1,

        // ── Customer ──────────────────────────────────────
        customer: 1,
        customerName: 1,
        customerMobile: 1,
        customerAddress: 1,
        customerGstNumber: 1,
        customerCity: 1,
        customerState: 1,
        customerCountry: 1,
        customerPostalCode: 1,
        customerDetails: 1,

        // ── Items ─────────────────────────────────────────
        items: 1,
        productDetails: 1,

        // ── Totals ────────────────────────────────────────
        subTotal: 1,
        gstTotal: 1,
        isIgst: 1,
        discountTotal: 1,
        roundOff: 1,
        grandTotal: 1,

        // ── Payment ───────────────────────────────────────
        paymentStatus: 1,
        amountPaid: 1,
        amountDue: 1,
        paymentMethod: 1,
        paymentNote: 1,

        // ── Store snapshot (embedded at invoice creation) ─
        name: 1,
        tagline: 1,
        ownershipType: 1,
        gstNumber: 1,
        panNumber: 1,
        registrationNo: 1,
        contactNo: 1,
        email: 1,
        address: 1,
        bankDetails: 1,
        settings: 1,
        logoUrl: 1,
        signatureUrl: 1,
        isActive: 1,

        // ── Timestamps ────────────────────────────────────
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ]);

  return result[0] || null;
};

export const getProductWiseInvoices = async (filters = {}) => {
  const { store, startDate, endDate } = filters;

  const matchStage = {
    status: { $ne: 'cancelled' }, // exclude cancelled invoices
  };

  if (store) {
    // Fix 1: always cast to ObjectId — safe whether store is string or ObjectId
    matchStage.store = new mongoose.Types.ObjectId(String(store));
  }

  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    matchStage.invoiceDate = { $gte: start, $lte: end };
  }

  console.log('matchStage =>', JSON.stringify(matchStage));

  const result = await Invoice.aggregate([
    { $match: matchStage },

    { $unwind: '$items' },

    {
      $project: {
        // Fix 2: keep invoiceDate as-is for sort; alias to `date` AFTER sort
        invoiceDate: 1,
        invoiceNumber: 1,
        grandTotal: 1,

        product: '$items.name',
        productHsn: '$items.hsn',
        unit: '$items.unit',
        price: '$items.sellingPrice',
        quantity: '$items.quantity',
        discount: '$items.discount',
        gstRate: '$items.gstRate',
        lineTotal: '$items.total',

        // Fix 3: compute taxableValue first, then derive gstAmount from it
        taxableValue: {
          $cond: {
            if: '$items.isTaxInclusive',
            then: {
              // inclusive: base = total / (1 + gstRate/100)
              $cond: {
                if: { $gt: ['$items.gstRate', 0] },
                then: {
                  $divide: ['$items.total', { $add: [1, { $divide: ['$items.gstRate', 100] }] }],
                },
                else: '$items.total',
              },
            },
            // exclusive: taxable = total / (1 + gstRate/100) — same formula works
            else: {
              $cond: {
                if: { $gt: ['$items.gstRate', 0] },
                then: {
                  $divide: ['$items.total', { $add: [1, { $divide: ['$items.gstRate', 100] }] }],
                },
                else: '$items.total',
              },
            },
          },
        },

        gstAmount: {
          $round: [
            {
              $cond: {
                if: { $gt: ['$items.gstRate', 0] },
                then: {
                  // gstAmount = total - (total / (1 + rate/100))
                  $subtract: [
                    '$items.total',
                    {
                      $divide: ['$items.total', { $add: [1, { $divide: ['$items.gstRate', 100] }] }],
                    },
                  ],
                },
                else: 0,
              },
            },
            2,
          ],
        },
      },
    },

    // Fix 2 continued: sort on invoiceDate (still exists at this stage)
    { $sort: { invoiceDate: 1, invoiceNumber: 1 } },

    // Rename invoiceDate → date only for the final output shape
    {
      $addFields: {
        date: '$invoiceDate',
      },
    },
    {
      $project: {
        invoiceDate: 0, // remove the original field from output
      },
    },
  ]);

  return result;
};

export const getGstSalesReport = async (filters = {}) => {
  const { store, startDate, endDate } = filters;

  const matchStage = {
    status: { $ne: 'cancelled' }, // cancelled invoice বাদ
  };

  if (store) {
    matchStage.store = new mongoose.Types.ObjectId(store);
  }

  if (startDate && endDate) {
    matchStage.invoiceDate = {
      $gte: startDate,
      $lte: endDate,
    };
  }

  const result = await Invoice.aggregate([
    { $match: matchStage },

    { $sort: { invoiceDate: 1, invoiceNumber: 1 } },

    { $unwind: '$items' },

    { $match: { 'items.gstRate': { $gt: 0 } } },

    {
      $project: {
        invoiceDate: 1,
        invoiceNumber: 1,

        customerName: {
          $ifNull: ['$customerName', 'Cash Customer'],
        },

        customerGst: {
          $ifNull: ['$customerGstNumber', '-'],
        },

        item: '$items.name',
        hsn: '$items.hsn',
        unit: '$items.unit',
        quantity: '$items.quantity',

        taxableValue: {
          $round: [
            {
              $divide: [
                '$items.total',
                {
                  $add: [
                    1,
                    {
                      $divide: ['$items.gstRate', 100],
                    },
                  ],
                },
              ],
            },
            2,
          ],
        },

        cgstPercent: {
          $divide: ['$items.gstRate', 2],
        },

        sgstPercent: {
          $divide: ['$items.gstRate', 2],
        },

        cgstAmount: {
          $round: [
            {
              $divide: [
                {
                  $subtract: [
                    '$items.total',
                    {
                      $divide: [
                        '$items.total',
                        {
                          $add: [
                            1,
                            {
                              $divide: ['$items.gstRate', 100],
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
            2,
          ],
        },

        sgstAmount: {
          $round: [
            {
              $divide: [
                {
                  $subtract: [
                    '$items.total',
                    {
                      $divide: [
                        '$items.total',
                        {
                          $add: [
                            1,
                            {
                              $divide: ['$items.gstRate', 100],
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
            2,
          ],
        },

        invoiceAmount: '$grandTotal',
      },
    },
  ]);

  return result;
};

export const getGstPurchaseReport = async (filters = {}) => {
  const { store, startDate, endDate } = filters;

  const matchStage = {
    status: { $ne: 'cancelled' }, // cancelled purchase বাদ
  };

  if (store) {
    matchStage.store = new mongoose.Types.ObjectId(store);
  }

  if (startDate && endDate) {
    matchStage.date = {
      $gte: startDate,
      $lte: endDate,
    };
  }

  const result = await Purchase.aggregate([
    { $match: matchStage },

    { $unwind: '$items' },

    { $match: { 'items.gstRate': { $gt: 0 } } },

    {
      $project: {
        invoiceDate: '$date',
        invoiceNumber: '$invoiceNumber',

        supplierName: {
          $ifNull: ['$vendorName', 'Unknown Vendor'],
        },

        supplierGst: {
          $ifNull: ['$vendorGstNumber', '-'],
        },

        item: '$items.name',

        hsn: {
          $ifNull: ['$items.hsn', '-'],
        },

        unit: '$items.unit',
        quantity: '$items.quantity',

        taxableValue: '$items.total',

        cgstPercent: {
          $divide: ['$items.gstRate', 2],
        },

        sgstPercent: {
          $divide: ['$items.gstRate', 2],
        },

        cgstAmount: {
          $round: [
            {
              $divide: [
                {
                  $multiply: ['$items.total', '$items.gstRate'],
                },
                200,
              ],
            },
            2,
          ],
        },

        sgstAmount: {
          $round: [
            {
              $divide: [
                {
                  $multiply: ['$items.total', '$items.gstRate'],
                },
                200,
              ],
            },
            2,
          ],
        },

        invoiceAmount: '$grandTotal',
      },
    },

    { $sort: { invoiceDate: 1, invoiceNumber: 1 } },
  ]);

  return result;
};

export const getProfitLossReport = async (filters = {}) => {
  const { store, startDate, endDate } = filters;

  const matchStage = {
    status: { $ne: 'cancelled' },
  };

  if (store) {
    matchStage.store = new mongoose.Types.ObjectId(String(store));
  }

  if (startDate && endDate) {
    matchStage.invoiceDate = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const result = await Invoice.aggregate([
    {
      $match: matchStage,
    },

    {
      $unwind: '$items',
    },

    // product wise purchase cost বের করবে
    {
      $lookup: {
        from: 'purchases',
        let: {
          productId: '$items.product',
        },
        pipeline: [
          {
            $match: {
              status: { $ne: 'cancelled' },
            },
          },
          {
            $unwind: '$items',
          },
          {
            $match: {
              $expr: {
                $eq: ['$items.product', '$$productId'],
              },
            },
          },
          {
            $sort: {
              createdAt: -1,
            },
          },
          {
            $limit: 1,
          },
          {
            $project: {
              gstRate: '$items.gstRate',
              isTaxInclusive: '$items.isTaxInclusive',
              quantity: '$items.quantity',
              total: '$items.total',
              rate: '$items.rate',
            },
          },
        ],
        as: 'purchaseData',
      },
    },

    {
      $addFields: {
        purchaseItem: {
          $arrayElemAt: ['$purchaseData', 0],
        },
      },
    },

    // GST included হলে remove GST from purchase cost
    {
      $addFields: {
        itemPurchaseCost: {
          $multiply: [
            '$items.quantity',
            {
              $cond: {
                if: {
                  $gt: ['$purchaseItem.gstRate', 0],
                },
                then: {
                  $cond: {
                    if: '$purchaseItem.isTaxInclusive',
                    then: {
                      $divide: [
                        '$purchaseItem.total',
                        {
                          $add: [
                            1,
                            {
                              $divide: [
                                '$purchaseItem.gstRate',
                                100,
                              ],
                            },
                          ],
                        },
                      ],
                    },
                    else: '$purchaseItem.total',
                  },
                },
                else: '$purchaseItem.total',
              },
            },
          ],
        },
      },
    },

    // invoice date অনুযায়ী expense match
    {
      $lookup: {
        from: 'expenses',
        let: {
          invoiceDate: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$invoiceDate',
              timezone: 'Asia/Kolkata',
            },
          },
          storeId: '$store',
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $eq: ['$store', '$$storeId'],
                  },
                  {
                    $eq: [
                      {
                        $dateToString: {
                          format: '%Y-%m-%d',
                          date: '$date',
                          timezone: 'Asia/Kolkata',
                        },
                      },
                      '$$invoiceDate',
                    ],
                  },
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              totalExpense: {
                $sum: '$amount',
              },
            },
          },
        ],
        as: 'expenseData',
      },
    },

    {
      $group: {
        _id: '$_id',

        invoiceDate: {
          $first: '$invoiceDate',
        },

        invoiceNumber: {
          $first: '$invoiceNumber',
        },

        customerName: {
          $first: '$customerName',
        },

        customerMobile: {
          $first: '$customerMobile',
        },

        invoiceAmount: {
          $first: '$grandTotal',
        },

        purchaseCost: {
          $sum: '$itemPurchaseCost',
        },

        expenseAmount: {
          $first: {
            $ifNull: [
              {
                $arrayElemAt: [
                  '$expenseData.totalExpense',
                  0,
                ],
              },
              0,
            ],
          },
        },
      },
    },

    {
      $project: {
        invoiceDate: 1,
        invoiceNumber: 1,
        invoiceAmount: 1,
        purchaseCost: {
          $round: ['$purchaseCost', 2],
        },
        expenseAmount: 1,

        customerDescription: {
          $concat: [
            {
              $ifNull: [
                '$customerName',
                'Cash Customer',
              ],
            },
            ' , ',
            {
              $ifNull: [
                '$customerMobile',
                '-',
              ],
            },
          ],
        },

        profitLoss: {
          $round: [
            {
              $subtract: [
                '$invoiceAmount',
                {
                  $add: [
                    '$purchaseCost',
                    '$expenseAmount',
                  ],
                },
              ],
            },
            2,
          ],
        },
      },
    },

    {
      $sort: {
        invoiceDate: 1,
      },
    },
  ]);

  return result;
};

// export async function getStockBalance(filters) {
//   const { store, itemName, asOnDate, startDate, endDate } = filters;

//   // Fix 1: For asOnDate, set time to end-of-day to include all transactions on that date.
//   // For date range, startDate begins at 00:00:00 and endDate ends at 23:59:59.
//   let dateFilter;
//   if (asOnDate) {
//     const endOfDay = new Date(asOnDate);
//     endOfDay.setHours(23, 59, 59, 999);
//     // No lower bound — asOnDate means "all stock up to and including this date"
//     dateFilter = { $lte: endOfDay };
//   } else {
//     const start = new Date(startDate);
//     start.setHours(0, 0, 0, 0);
//     const end = new Date(endDate);
//     end.setHours(23, 59, 59, 999);
//     dateFilter = { $gte: start, $lte: end };
//   }

//   const baseMatch = {
//     store: new mongoose.Types.ObjectId(store), // Fix 2: ensure ObjectId comparison
//     date: dateFilter,
//   };

//   const pipeline = [
//     { $match: baseMatch },

//     // Join product to get item name
//     {
//       $lookup: {
//         from: 'products',
//         localField: 'product',
//         foreignField: '_id',
//         as: 'productInfo',
//       },
//     },
//     { $unwind: '$productInfo' },

//     // Optional item name filter
//     ...(itemName ? [{ $match: { 'productInfo.name': { $regex: itemName, $options: 'i' } } }] : []),

//     {
//       $group: {
//         _id: '$product',
//         itemDescription: { $first: '$productInfo.name' },

//         // Fix 3: Use abs(quantity) to guard against any negatively-stored OUT quantities
//         totalIn: {
//           $sum: {
//             $cond: [
//               { $eq: ['$direction', 'IN'] },
//               { $abs: '$quantity' }, // always treat as positive
//               0,
//             ],
//           },
//         },
//         totalOut: {
//           $sum: {
//             $cond: [
//               { $eq: ['$direction', 'OUT'] },
//               { $abs: '$quantity' }, // always treat as positive
//               0,
//             ],
//           },
//         },

//         // Weighted average cost from IN transactions only
//         totalInValue: {
//           $sum: {
//             $cond: [
//               { $eq: ['$direction', 'IN'] },
//               {
//                 $multiply: [{ $abs: '$quantity' }, { $ifNull: ['$rate', 0] }],
//               },
//               0,
//             ],
//           },
//         },
//       },
//     },

//     {
//       $project: {
//         _id: 0,
//         itemDescription: 1,
//         totalIn: 1,
//         totalOut: 1,
//         // Fix 4: closing balance = IN - OUT (both are now positive sums)
//         quantity: { $subtract: ['$totalIn', '$totalOut'] },
//         avgRate: {
//           $cond: [{ $gt: ['$totalIn', 0] }, { $divide: ['$totalInValue', '$totalIn'] }, 0],
//         },
//       },
//     },

//     {
//       $addFields: {
//         itemValue: {
//           $round: [{ $multiply: ['$quantity', '$avgRate'] }, 2],
//         },
//       },
//     },

//     // Fix 5: allow negative balance to show (for audit trail), or keep $ne: 0 if preferred
//     { $match: { quantity: { $ne: 0 } } },
//     { $sort: { itemDescription: 1 } },
//   ];

//   const result = await StockTransaction.aggregate(pipeline);

//   return result.map(({ itemDescription, quantity, itemValue, totalIn, totalOut }) => ({
//     itemDescription,
//     quantity,
//     itemValue,
//     totalIn,
//     totalOut,
//   }));
// }

export const getItemStockReport = async (filters = {}) => {
  const { store, itemName, asOnDate, startDate, endDate } = filters;

  // Build date filter
  const dateFilter = asOnDate ? { $lte: asOnDate } : { $gte: startDate, $lte: endDate };

  const baseMatch = {
    store,
    date: dateFilter,
  };

  // --- Aggregate stock IN and OUT from StockTransaction ---
  const pipeline = [
    { $match: baseMatch },
    // Join product to get item name for filtering
    {
      $lookup: {
        from: 'products', // adjust to your actual collection name
        localField: 'product',
        foreignField: '_id',
        as: 'productInfo',
      },
    },
    { $unwind: '$productInfo' },
    // Apply itemName filter if provided
    ...(itemName ? [{ $match: { 'productInfo.name': { $regex: itemName, $options: 'i' } } }] : []),
    {
      $group: {
        _id: '$product',
        itemDescription: { $first: '$productInfo.name' },
        totalIn: {
          $sum: {
            $cond: [{ $eq: ['$direction', 'IN'] }, '$quantity', 0],
          },
        },
        totalOut: {
          $sum: {
            $cond: [{ $eq: ['$direction', 'OUT'] }, '$quantity', 0],
          },
        },
        // Weighted average rate from IN transactions only
        totalInValue: {
          $sum: {
            $cond: [{ $eq: ['$direction', 'IN'] }, { $multiply: ['$quantity', { $ifNull: ['$rate', 0] }] }, 0],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        itemDescription: 1,
        quantity: { $subtract: ['$totalIn', '$totalOut'] },
        avgRate: {
          $cond: [{ $gt: ['$totalIn', 0] }, { $divide: ['$totalInValue', '$totalIn'] }, 0],
        },
        totalIn: 1,
        totalOut: 1,
      },
    },
    {
      $addFields: {
        itemValue: {
          $round: [{ $multiply: ['$quantity', '$avgRate'] }, 2],
        },
      },
    },
    { $match: { quantity: { $ne: 0 } } }, // omit zero-stock items
    { $sort: { itemDescription: 1 } },
  ];

  const result = await StockTransaction.aggregate(pipeline);

  return result.map(({ itemDescription, quantity, itemValue, totalIn, totalOut }) => ({
    itemDescription,
    quantity,
    itemValue,
    totalIn,
    totalOut,
  }));
};

export const getStockBalance = async (filters = {}) => {
  const { store, itemName, asOnDate, startDate, endDate } = filters;

  const baseMatch = {
    store: new mongoose.Types.ObjectId(String(store)),

    status: {
      $ne: 'cancelled',
    },
  };

  // Item name search
  if (itemName) {
    baseMatch.name = {
      $regex: itemName,
      $options: 'i',
    };
  }

  // Date filter for transactions
  let dateCondition = [];

  if (asOnDate) {
    dateCondition = [
      {
        $lte: ['$date', new Date(asOnDate)],
      },
    ];
  } else if (startDate && endDate) {
    dateCondition = [
      {
        $gte: ['$date', new Date(startDate)],
      },
      {
        $lte: ['$date', new Date(endDate)],
      },
    ];
  }

  const pipeline = [
    {
      $match: baseMatch,
    },

    {
      $lookup: {
        from: 'stocktransactions',

        let: {
          productId: '$_id',
        },

        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $eq: ['$product', '$$productId'],
                  },

                  {
                    $eq: ['$store', new mongoose.Types.ObjectId(String(store))],
                  },

                  ...dateCondition,
                ],
              },
            },
          },
        ],

        as: 'transactions',
      },
    },

    // Calculate stock movement
    {
      $addFields: {
        totalIn: {
          $sum: {
            $map: {
              input: '$transactions',

              as: 'tx',

              in: {
                $cond: [
                  {
                    $eq: ['$$tx.direction', 'IN'],
                  },

                  {
                    $abs: '$$tx.quantity',
                  },

                  0,
                ],
              },
            },
          },
        },

        totalOut: {
          $sum: {
            $map: {
              input: '$transactions',

              as: 'tx',

              in: {
                $cond: [
                  {
                    $eq: ['$$tx.direction', 'OUT'],
                  },

                  {
                    $abs: '$$tx.quantity',
                  },

                  0,
                ],
              },
            },
          },
        },

        totalInValue: {
          $sum: {
            $map: {
              input: '$transactions',

              as: 'tx',

              in: {
                $cond: [
                  {
                    $eq: ['$$tx.direction', 'IN'],
                  },

                  {
                    $multiply: [
                      {
                        $abs: '$$tx.quantity',
                      },

                      {
                        $ifNull: ['$$tx.rate', 0],
                      },
                    ],
                  },

                  0,
                ],
              },
            },
          },
        },
      },
    },

    // Historical stock calculation
    {
      $addFields: {
        quantity: {
          $subtract: ['$totalIn', '$totalOut'],
        },
      },
    },

    {
      $project: {
        _id: 0,

        itemDescription: '$name',

        quantity: 1,

        totalIn: 1,
        totalOut: 1,

        avgRate: {
          $cond: [
            {
              $gt: ['$totalIn', 0],
            },

            {
              $divide: ['$totalInValue', '$totalIn'],
            },

            {
              $ifNull: [
                '$lastPurchasePrice',

                {
                  $ifNull: ['$costPrice', 0],
                },
              ],
            },
          ],
        },
      },
    },

    {
      $addFields: {
        itemValue: {
          $round: [
            {
              $multiply: ['$quantity', '$avgRate'],
            },

            2,
          ],
        },
      },
    },

    {
      $sort: {
        itemDescription: 1,
      },
    },
  ];

  const result = await Product.aggregate(pipeline);

  return result.map(({ itemDescription, quantity, itemValue, totalIn, totalOut }) => ({
    itemDescription,
    quantity,
    itemValue,
    totalIn,
    totalOut,
  }));
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

export const cancelAfterSaleStock = async (invoiceId) => {
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const session = await mongoose.startSession();
    session.startTransaction({
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
    });

    try {
      const existingInvoice = await Invoice.findOne({
        _id: invoiceId,
      }).session(session);

      if (!existingInvoice) {
        throw new Error(`Purchase not found: ${invoiceId}`);
      }

      // Step 1: Reverse stock
      await reverseStockAfterSale(existingInvoice, session); // ✅ fixed name

      // Step 2: Reverse vendor payment ledger

      await session.commitTransaction(); // ✅ was missing entirely
      await session.endSession();

      return existingInvoice;
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
