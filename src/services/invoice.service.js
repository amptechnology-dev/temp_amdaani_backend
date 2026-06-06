import { Invoice } from '../models/invoice.model.js';
import { findOrCreateProduct } from '../services/product.service.js';
import { findOrCreateCustomer } from '../services/customer.service.js';
import { ApiError } from '../utils/responseHandler.js';
import mongoose from 'mongoose';
import { handleDuplicateKeyError } from '../utils/dbErrorHandler.js';
import { createTransaction, getTransactionsByInvoice } from './transaction.service.js';
import { updateStockAfterSale, reverseStockAfterSale, createupdateStockAfterSale } from './product.service.js';
import { Product } from '../models/product.model.js';
import { Purchase } from '../models/purchase.model.js';
import { StockTransaction } from '../models/stockTransaction.model.js';
import { Expense } from '../models/expense.model.js';
import { Store } from '../models/store.model.js';
import { json } from 'express';
import { Transaction } from '../models/transaction.model.js';
import { StockTransactionType } from '../config/constants.js';

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

    const invoiceItems = [];

    for (const item of items) {
      const productId = await findOrCreateProduct(data.store, item, session);

      if (productId) {
        const product = await Product.findById(productId).session(session);

        if (!product) {
          throw new ApiError(404, `Product not found: ${item.name}`);
        }

        // if (store.settings?.stockManagement && product.currentStock < item.quantity) {
        //   throw new ApiError(400, `Insufficient stock for ${product.name}`, {
        //     source: 'body',
        //     field: 'items',
        //     message: `${product.name} stock is only ${product.currentStock}, but you are trying to sell ${item.quantity}`,
        //   });
        // }
      }
      invoiceItems.push({
        ...item,

        ...(productId
          ? {
              product: productId,
            }
          : {}),
      });
    }

    console.log('Invoice Items:', JSON.stringify(invoiceItems));

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

    const invoiceDoc = {
      ...data,
      items: invoiceItems,
      customer: customerId,
      userId: data.userId,

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

    await invoice.save({
      session,
    });

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

    await createupdateStockAfterSale(invoice, session);

    await session.commitTransaction();

    return invoice;
  } catch (error) {
    await session.abortTransaction();

    throw handleDuplicateKeyError(error) || error;
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

    const invoice = await Invoice.findById(invoiceId).session(session);
    if (!invoice) throw new ApiError(404, 'Invoice not found');

    // --- Step 1: Build invoice items (with resolved productIds) ---
    const invoiceItems = [];
    for (const item of items) {
      const productId = await findOrCreateProduct(invoice.store, item, session);

      if (!productId) {
        console.warn(`[updateInvoice] No productId resolved for item: "${item.name}"`);
      }

      invoiceItems.push({
        ...item,
        // ✅ Always attach product field — resolved or fallback to existing
        product: productId ?? item.product ?? null,
      });
    }

    console.log(
      '[updateInvoice] resolved items:',
      JSON.stringify(invoiceItems.map((i) => ({ name: i.name, product: i.product })))
    );

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

    // --- Step 3: Reverse old stock ---
    await reverseStockAfterSale(invoice, session);

    // --- Step 4: Reverse old transaction ---
    await Transaction.deleteMany({ invoice: invoice._id }, { session });

    // --- Step 5: Update invoice fields ---
    invoice.set({
      ...data,
      items: invoiceItems,
      customer: customerId,
      edited: true,
    });

    await invoice.save({ session });

    // --- Step 6: Recreate transaction ---
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

    // --- Step 7: Apply new stock ---
    // ✅ Pass data from request.body BUT with productIds injected from Step 1
    await updateStockAfterSale(
      {
        ...data, // all request.body fields (invoiceDate, storeSettings, etc.)
        _id: invoice._id, // ✅ needed for saleId in stock transaction
        items: invoiceItems, // ✅ items now have product field attached
      },
      session
    );

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

  return result[0] || null;
};

export const queryInvoices = async (filter = {}, options = {}) => {
  const { page = 1, limit = 20, sortBy = 'createdAt', order = 'desc' } = options;

  if (filter.userId) {
    filter.userId = new mongoose.Types.ObjectId(String(filter.userId));
  }

  const aggregate = Invoice.aggregate([
    { $match: filter },

    // ── STORE LOOKUP ──────────────────────────────────────────────────────
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

    // ── MAIN CALCULATION ──────────────────────────────────────────────────
    {
      $addFields: {
        discountTotal: {
          $round: [
            {
              $sum: {
                $map: {
                  input: '$items',
                  as: 'it',
                  in: {
                    $let: {
                      vars: {
                        qty: { $ifNull: ['$$it.quantity', 0] },
                        disc: { $ifNull: ['$$it.discount', 0] },
                        gstRate: { $ifNull: ['$$it.gstRate', 0] },
                        isIncl: { $ifNull: ['$$it.isTaxInclusive', false] },
                      },
                      in: {
                        $let: {
                          vars: {
                            totalDisc: { $multiply: ['$$disc', '$$qty'] },
                            divisor: {
                              $add: [1, { $divide: ['$$gstRate', 100] }],
                            },
                          },
                          in: {
                            $cond: [
                              // inclusive AND gstRate > 0 → back-calc
                              {
                                $and: [{ $eq: ['$$isIncl', true] }, { $gt: ['$$gstRate', 0] }],
                              },
                              { $divide: ['$$totalDisc', '$$divisor'] },
                              // all other cases → raw
                              '$$totalDisc',
                            ],
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            2,
          ],
        },

        taxableValue: {
          $round: [
            {
              $sum: {
                $map: {
                  input: '$items',
                  as: 'it',
                  in: {
                    $let: {
                      vars: {
                        qty: { $ifNull: ['$$it.quantity', 0] },
                        price: { $ifNull: ['$$it.sellingPrice', 0] },
                        disc: { $ifNull: ['$$it.discount', 0] },
                        gstRate: { $ifNull: ['$$it.gstRate', 0] },
                        isIncl: { $ifNull: ['$$it.isTaxInclusive', false] },
                      },
                      in: {
                        $let: {
                          vars: {
                            baseAmt: { $multiply: ['$$price', '$$qty'] },
                            totalDisc: { $multiply: ['$$disc', '$$qty'] },
                            divisor: {
                              $add: [1, { $divide: ['$$gstRate', 100] }],
                            },
                          },
                          in: {
                            $cond: [
                              // gstRate = 0 → taxableValue = 0
                              { $eq: ['$$gstRate', 0] },
                              0,
                              {
                                $max: [
                                  0,
                                  {
                                    $cond: [
                                      '$$isIncl',
                                      // inclusive: strip GST from net amount
                                      {
                                        $divide: [{ $subtract: ['$$baseAmt', '$$totalDisc'] }, '$$divisor'],
                                      },
                                      // exclusive: plain subtraction
                                      { $subtract: ['$$baseAmt', '$$totalDisc'] },
                                    ],
                                  },
                                ],
                              },
                            ],
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            2,
          ],
        },

        gstTotal: {
          $round: [
            {
              $sum: {
                $map: {
                  input: '$items',
                  as: 'it',
                  in: {
                    $let: {
                      vars: {
                        qty: { $ifNull: ['$$it.quantity', 0] },
                        price: { $ifNull: ['$$it.sellingPrice', 0] },
                        disc: { $ifNull: ['$$it.discount', 0] },
                        gstRate: { $ifNull: ['$$it.gstRate', 0] },
                        isIncl: { $ifNull: ['$$it.isTaxInclusive', false] },
                      },
                      in: {
                        $cond: [
                          // gstRate = 0 → no GST
                          { $eq: ['$$gstRate', 0] },
                          0,
                          {
                            $let: {
                              vars: {
                                baseAmt: { $multiply: ['$$price', '$$qty'] },
                                totalDisc: { $multiply: ['$$disc', '$$qty'] },
                                divisor: {
                                  $add: [1, { $divide: ['$$gstRate', 100] }],
                                },
                              },
                              in: {
                                $let: {
                                  vars: {
                                    itemTaxable: {
                                      $max: [
                                        0,
                                        {
                                          $cond: [
                                            '$$isIncl',
                                            {
                                              $divide: [{ $subtract: ['$$baseAmt', '$$totalDisc'] }, '$$divisor'],
                                            },
                                            { $subtract: ['$$baseAmt', '$$totalDisc'] },
                                          ],
                                        },
                                      ],
                                    },
                                  },
                                  in: {
                                    $multiply: ['$$itemTaxable', { $divide: ['$$gstRate', 100] }],
                                  },
                                },
                              },
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              },
            },
            2,
          ],
        },
      },
    },

    // ── CGST / SGST / IGST + totalAmount ─────────────────────────────────
    {
      $addFields: {
        cgstTotal: {
          $round: [
            {
              $cond: [{ $eq: ['$isIgst', true] }, 0, { $divide: ['$gstTotal', 2] }],
            },
            2,
          ],
        },
        sgstTotal: {
          $round: [
            {
              $cond: [{ $eq: ['$isIgst', true] }, 0, { $divide: ['$gstTotal', 2] }],
            },
            2,
          ],
        },
        igstTotal: {
          $round: [
            {
              $cond: [{ $eq: ['$isIgst', true] }, '$gstTotal', 0],
            },
            2,
          ],
        },

        // totalAmount = taxableValue + gstTotal
        // (only GST items contribute to both fields)
        totalAmount: {
          $round: [{ $add: ['$taxableValue', '$gstTotal'] }, 2],
        },
      },
    },

    // Hide raw items from response
    {
      $project: { items: 0 },
    },

    {
      $sort: {
        [sortBy]: order === 'desc' ? -1 : 1,
      },
    },
  ]);

  return Invoice.aggregatePaginate(aggregate, {
    page: Number(page),
    limit: Number(limit),
    lean: true,
    leanWithId: false,
  });
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
    status: {
      $ne: 'cancelled',
    },
  };

  // store filter
  if (store) {
    matchStage.store = new mongoose.Types.ObjectId(String(store));
  }

  // date filter
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

    // latest purchase
    {
      $lookup: {
        from: 'purchases',
        let: {
          productId: '$items.product',
        },
        pipeline: [
          {
            $match: {
              status: {
                $ne: 'cancelled',
              },
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
              rate: '$items.rate',
              quantity: '$items.quantity',
              productName: '$items.name',
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

    // calculation
    {
      $addFields: {
        itemSalesAmount: {
          $multiply: [
            {
              $ifNull: ['$items.sellingPrice', 0],
            },
            {
              $ifNull: ['$items.quantity', 0],
            },
          ],
        },

        itemPurchaseCost: {
          $multiply: [
            {
              $ifNull: ['$purchaseItem.rate', 0],
            },
            {
              $ifNull: ['$items.quantity', 0],
            },
          ],
        },
      },
    },

    // item profit
    {
      $addFields: {
        itemProfit: {
          $subtract: ['$itemSalesAmount', '$itemPurchaseCost'],
        },
      },
    },

    // invoice group
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

        // details per item
        items: {
          $push: {
            product: '$items.name',

            quantity: '$items.quantity',

            invoicePrice: '$items.sellingPrice',

            invoiceAmount: '$itemSalesAmount',

            purchasePrice: '$purchaseItem.rate',

            purchaseAmount: '$itemPurchaseCost',

            itemProfit: '$itemProfit',
          },
        },

        totalSales: {
          $sum: '$itemSalesAmount',
        },

        totalPurchase: {
          $sum: '$itemPurchaseCost',
        },

        totalProfit: {
          $sum: '$itemProfit',
        },
      },
    },

    {
      $project: {
        invoiceDate: 1,
        invoiceNumber: 1,

        customerDescription: {
          $concat: [
            {
              $ifNull: ['$customerName', 'Cash Customer'],
            },
            ' , ',
            {
              $ifNull: ['$customerMobile', '-'],
            },
          ],
        },

        items: 1,

        totalSales: {
          $round: ['$totalSales', 2],
        },

        totalPurchase: {
          $round: ['$totalPurchase', 2],
        },

        profitLoss: {
          $round: ['$totalProfit', 2],
        },
      },
    },

    {
      $sort: {
        invoiceDate: 1,
      },
    },
  ]);

  // overall summary
  const overall = result.reduce(
    (acc, curr) => {
      acc.totalSales += curr.totalSales || 0;

      acc.totalPurchase += curr.totalPurchase || 0;

      acc.totalProfit += curr.profitLoss || 0;

      return acc;
    },
    {
      totalSales: 0,
      totalPurchase: 0,
      totalProfit: 0,
    }
  );

  return {
    summary: {
      totalSales: overall.totalSales,
      totalPurchase: overall.totalPurchase,
      totalProfit: overall.totalProfit,
    },

    invoices: result,
  };
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

const getFinancialYearDateRange = (financialYear) => {
  const startYear = parseInt(financialYear.split('-')[0]);
  const endYear = startYear + 1;

  const startDate = new Date(startYear, 3, 1); // April 1
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(endYear, 2, 31); // March 31
  endDate.setHours(23, 59, 59, 999);

  return { startDate, endDate };
};

export const getStockBalance = async (filters = {}) => {
  const { store, itemName, transactionType, minStock, maxStock, financialYear } = filters;

  const storeId = new mongoose.Types.ObjectId(String(store));

  const { startDate: fyStartDate, endDate: fyEndDate } = financialYear
    ? getFinancialYearDateRange(financialYear)
    : { startDate: null, endDate: null };

  // ===================
  // PRODUCT FILTER
  // ===================
  const productMatch = {
    store: storeId,
    status: { $ne: 'cancelled' },
  };

  if (itemName && itemName.trim()) {
    productMatch.name = {
      $regex: itemName.trim(),
      $options: 'i',
    };
  }

  const data = await Product.aggregate([
    { $match: productMatch },

    // ===================
    // OPENING STOCK QTY & VALUE
    // ===================
    {
      $addFields: {
        _fyStock: {
          $arrayElemAt: [
            {
              $filter: {
                input: '$financialYearStocks',
                as: 'fy',
                cond: { $eq: ['$$fy.financialYear', financialYear] },
              },
            },
            0,
          ],
        },
      },
    },
    {
      $addFields: {
        // Opening stock quantity for this FY
        openingStock: { $ifNull: ['$_fyStock.stock', 0] },

        // Opening stock value for this FY
        openingStockValue: { $ifNull: ['$_fyStock.value', 0] },
      },
    },

    // ===================
    // PURCHASE TABLE
    // ===================
    {
      $lookup: {
        from: 'purchases',
        let: { productId: '$_id' },
        pipeline: [
          {
            $match: {
              store: storeId,
              status: { $ne: 'cancelled' },
              ...(fyStartDate && fyEndDate ? { date: { $gte: fyStartDate, $lte: fyEndDate } } : {}),
            },
          },
          { $unwind: '$items' },
          {
            $match: {
              $expr: { $eq: ['$items.product', '$$productId'] },
            },
          },
          {
            $group: {
              _id: null,
              totalQty: { $sum: '$items.quantity' },
              totalValue: {
                $sum: { $multiply: ['$items.quantity', '$items.rate'] },
              },
              // Last purchase rate — used for currentStockValue
              lastPurchaseRate: { $last: '$items.rate' },
            },
          },
        ],
        as: 'purchaseData',
      },
    },

    // ===================
    // SALES TABLE
    // ===================
    {
      $lookup: {
        from: 'invoices',
        let: { productId: '$_id' },
        pipeline: [
          {
            $match: {
              store: storeId,
              status: { $ne: 'cancelled' },
              ...(fyStartDate && fyEndDate ? { invoiceDate: { $gte: fyStartDate, $lte: fyEndDate } } : {}),
            },
          },
          { $unwind: '$items' },
          {
            $match: {
              $expr: { $eq: ['$items.product', '$$productId'] },
            },
          },
          {
            $group: {
              _id: null,
              qty: { $sum: '$items.quantity' },
            },
          },
        ],
        as: 'salesData',
      },
    },

    // ===================
    // STOCK TRANSACTIONS
    // ===================
    {
      $lookup: {
        from: 'stocktransactions',
        let: { productId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$product', '$$productId'] },
                  { $eq: ['$store', storeId] },
                  ...(fyStartDate && fyEndDate
                    ? [{ $gte: ['$date', fyStartDate] }, { $lte: ['$date', fyEndDate] }]
                    : []),
                ],
              },
            },
          },
        ],
        as: 'transactions',
      },
    },

    // ===================
    // CALCULATIONS
    // ===================
    {
      $addFields: {
        // ---------- Quantities from lookups ----------
        purchaseQty: {
          $ifNull: [{ $arrayElemAt: ['$purchaseData.totalQty', 0] }, 0],
        },
        purchaseTotalValue: {
          $ifNull: [{ $arrayElemAt: ['$purchaseData.totalValue', 0] }, 0],
        },
        lastPurchaseRate: {
          $ifNull: [{ $arrayElemAt: ['$purchaseData.lastPurchaseRate', 0] }, 0],
        },
        saleQty: {
          $ifNull: [{ $arrayElemAt: ['$salesData.qty', 0] }, 0],
        },

        // ---------- Transaction-based quantities ----------
        returnInQty: {
          // SALE_RETURN → stock comes back IN
          $sum: {
            $map: {
              input: '$transactions',
              as: 'tx',
              in: {
                $cond: [{ $eq: ['$$tx.transactionType', 'SALE_RETURN'] }, '$$tx.quantity', 0],
              },
            },
          },
        },

        returnOutQty: {
          // PURCHASE_RETURN → stock goes OUT
          $sum: {
            $map: {
              input: '$transactions',
              as: 'tx',
              in: {
                $cond: [{ $eq: ['$$tx.transactionType', 'PURCHASE_RETURN'] }, '$$tx.quantity', 0],
              },
            },
          },
        },

        damageQty: {
          $sum: {
            $map: {
              input: '$transactions',
              as: 'tx',
              in: {
                $cond: [{ $eq: ['$$tx.transactionType', 'DAMAGE'] }, '$$tx.quantity', 0],
              },
            },
          },
        },

        expiredQty: {
          $sum: {
            $map: {
              input: '$transactions',
              as: 'tx',
              in: {
                $cond: [{ $eq: ['$$tx.transactionType', 'EXPIRED'] }, '$$tx.quantity', 0],
              },
            },
          },
        },

        // adjustmentQty = (IN adjustments) − (OUT adjustments)
        // IN  types : NEW_PURCHASE, STOCK_CORRECTION (direction=IN), FREE_STOCK (direction=IN)
        // OUT types : INTERNAL_USE, STOCK_REDUCE, STOCK_CORRECTION (direction=OUT), FREE_STOCK (direction=OUT)
        adjustmentQty: {
          $subtract: [
            // IN side
            {
              $sum: {
                $map: {
                  input: '$transactions',
                  as: 'tx',
                  in: {
                    $cond: [
                      {
                        $in: ['$$tx.transactionType', ['NEW_PURCHASE', 'STOCK_CORRECTION', 'FREE_STOCK']],
                      },
                      {
                        $cond: [
                          { $eq: ['$$tx.direction', 'IN'] },
                          '$$tx.quantity',
                          { $multiply: ['$$tx.quantity', -1] },
                        ],
                      },
                      0,
                    ],
                  },
                },
              },
            },
            // OUT side
            {
              $sum: {
                $map: {
                  input: '$transactions',
                  as: 'tx',
                  in: {
                    $cond: [
                      {
                        $in: ['$$tx.transactionType', ['INTERNAL_USE', 'STOCK_REDUCE']],
                      },
                      '$$tx.quantity',
                      0,
                    ],
                  },
                },
              },
            },
          ],
        },

        closingStock: '$currentStock',
      },
    },

    // ===================
    // RATE CALCULATIONS
    // (done in a separate $addFields so we can reference fields set above)
    // ===================
    {
      $addFields: {
        // Opening stock rate = openingStockValue / openingStock  (0 if no opening stock)
        openingStockRate: {
          $cond: [{ $gt: ['$openingStock', 0] }, { $divide: ['$openingStockValue', '$openingStock'] }, 0],
        },

        // Average Purchase Rate
        // = (openingStockValue + totalPurchaseValue) / (openingStock + purchaseQty)
        avgRate: {
          $cond: [
            { $gt: [{ $add: ['$openingStock', '$purchaseQty'] }, 0] },
            {
              $divide: [
                { $add: ['$openingStockValue', '$purchaseTotalValue'] },
                { $add: ['$openingStock', '$purchaseQty'] },
              ],
            },
            0,
          ],
        },
      },
    },

    // ===================
    // TRANSACTION TYPE FILTER
    // ===================
    ...(transactionType
      ? [
          {
            $match: (() => {
              switch (transactionType) {
                case 'DAMAGE':
                  return {
                    damageQty: { $gt: 0 },
                  };

                case 'EXPIRED':
                  return {
                    expiredQty: { $gt: 0 },
                  };

                case 'PURCHASE':
                  return {
                    purchaseQty: { $gt: 0 },
                  };

                case 'SALE':
                  return {
                    saleQty: { $gt: 0 },
                  };

                case 'PURCHASE_RETURN':
                  return {
                    returnOutQty: { $gt: 0 },
                  };

                case 'SALE_RETURN':
                  return {
                    returnInQty: { $gt: 0 },
                  };

                default:
                  return {};
              }
            })(),
          },
        ]
      : []),

    // ===================
    // STOCK RANGE FILTER
    // ===================
    ...(minStock || maxStock
      ? [
          {
            $match: {
              closingStock: {
                ...(minStock ? { $gte: Number(minStock) } : {}),
                ...(maxStock ? { $lte: Number(maxStock) } : {}),
              },
            },
          },
        ]
      : []),

    // ===================
    // RESPONSE
    // ===================
    {
      $project: {
        _id: 0,

        itemDescription: '$name',

        openingStock: 1,

        purchaseQty: 1,

        saleQty: 1,

        returnInQty: 1,

        returnOutQty: 1,

        damageQty: 1,

        expiredQty: 1,

        adjustmentQty: 1,

        closingStock: 1,

        // Average Purchase Rate
        // = (openingStockValue + totalPurchaseValue) / (openingStock + purchaseQty)
        avgRate: { $ifNull: ['$avgRate', 0] },

        // Average Stock Value = closingStock × avgRate
        averageStockValue: {
          $multiply: ['$closingStock', { $ifNull: ['$avgRate', 0] }],
        },

        // Current Stock Value = closingStock × lastPurchaseRate
        // Fallback: if no purchase in this FY → use openingStockRate
        currentStockValue: {
          $multiply: [
            '$closingStock',
            {
              $cond: [{ $gt: ['$lastPurchaseRate', 0] }, '$lastPurchaseRate', '$openingStockRate'],
            },
          ],
        },
      },
    },

    { $sort: { itemDescription: 1 } },
  ]);

  return { data };
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

export const getCustomerReport = async ({ store, startDate, endDate }) => {
  const match = {
    store: new mongoose.Types.ObjectId(String(store)),

    // ✅ Fully paid invoices বাদ যাবে
    paymentStatus: {
      $ne: 'paid',
    },

    // Optional:
    status: {
      $ne: 'cancelled',
    },
  };

  if (startDate && endDate) {
    match.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  return Invoice.aggregate([
    {
      $match: match,
    },

    {
      $lookup: {
        from: 'customers',
        localField: 'customer',
        foreignField: '_id',
        as: 'customer',
      },
    },

    {
      $unwind: {
        path: '$customer',
        preserveNullAndEmptyArrays: true,
      },
    },

    {
      $sort: {
        createdAt: -1,
      },
    },

    {
      $group: {
        _id: '$customer._id',

        customerName: {
          $first: '$customer.name',
        },

        invoices: {
          $push: {
            _id: '$_id',
            invoiceNumber: '$invoiceNumber',
            grandTotal: '$grandTotal',
            amountPaid: '$amountPaid',
            amountDue: '$amountDue',
            paymentStatus: '$paymentStatus',
            status: '$status',
            createdAt: '$createdAt',
          },
        },

        totalInvoices: {
          $sum: 1,
        },

        totalAmount: {
          $sum: '$grandTotal',
        },

        totalPaid: {
          $sum: '$amountPaid',
        },

        totalDue: {
          $sum: '$amountDue',
        },
      },
    },

    {
      $project: {
        _id: 0,
        customerName: 1,
        totalInvoices: 1,
        totalAmount: 1,
        totalPaid: 1,
        totalDue: 1,
        invoices: 1,
      },
    },

    {
      $sort: {
        customerName: 1,
      },
    },
  ]);
};
