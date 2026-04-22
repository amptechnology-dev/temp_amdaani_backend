import { Invoice } from '../models/invoice.model.js';
import { findOrCreateProduct } from '../services/product.service.js';
import { findOrCreateCustomer } from '../services/customer.service.js';
import { ApiError } from '../utils/responseHandler.js';
import mongoose from 'mongoose';
import { handleDuplicateKeyError } from '../utils/dbErrorHandler.js';
import { createTransaction, getTransactionsByInvoice } from './transaction.service.js';
import { updateStockAfterSale } from './product.service.js';
import { Product } from '../models/product.model.js';
import { Purchase } from '../models/purchase.model.js';

import { Store } from '../models/store.model.js';

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
      invoiceItems.push({ product: productId, ...item });
    }

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
  invoicePrefix:
    data.settings?.invoicePrefix ||
    store.settings?.invoicePrefix ||
    'INV',

  invoiceStartNumber:
    data.settings?.invoiceStartNumber ||
    store.settings?.invoiceStartNumber ||
    1,

  taxRates: data.settings?.taxRates || store.settings?.taxRates || [],

  invoiceTerms:
    data.settings?.invoiceTerms || store.settings?.invoiceTerms,

  stockManagement:
    data.settings?.stockManagement ??
    store.settings?.stockManagement ??
    false,

  purchaseOrderManagement:
    data.settings?.purchaseOrderManagement ??
    store.settings?.purchaseOrderManagement ??
    false,
},
      logoUrl: store.logoUrl,
      signatureUrl: store.signatureUrl,
      isActive: store.isActive,
    };

    const invoice = new Invoice(invoiceDoc);
    await invoice.save({ session }); // ✅ correct syntax

    // Create transaction if partial payment
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

    // Find the invoice first
    const invoice = await Invoice.findById(invoiceId).session(session);
    if (!invoice) throw new ApiError(404, 'Invoice not found');

    // --- Step 1: Update or re-link products ---
    const invoiceItems = [];
    for (const item of items) {
      const productId = await Product.findById(item.items.product).session(session);
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

  const matchStage = {};

  if (store) {
    matchStage.store = store;
  }

  if (startDate && endDate) {
    matchStage.invoiceDate = {
      $gte: startDate,
      $lte: endDate,
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
          $round: [
            {
              $multiply: ['$items.total', { $divide: ['$items.gstRate', 100] }],
            },
            2,
          ],
        },

        lineTotal: '$items.total',
        grandTotal: '$grandTotal',
      },
    },

    { $sort: { date: 1, invoiceNumber: 1 } },
  ]);

  return result;
};

export const getGstSalesReport = async (filters = {}) => {
  const { store, startDate, endDate } = filters;

  const matchStage = {
    gstTotal: { $gt: 0 },
  };

  if (store) {
    matchStage.store = store;
  }

  if (startDate && endDate) {
    matchStage.invoiceDate = {
      $gte: startDate,
      $lte: endDate,
    };
  }

  const result = await Invoice.aggregate([
    { $match: matchStage },

    { $unwind: '$items' },

    { $sort: { invoiceDate: 1, invoiceNumber: 1 } },

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

        // Back-calculate taxable value (excluding GST) from GST-inclusive total
        taxableValue: {
          $round: [
            {
              $divide: ['$items.total', { $add: [1, { $divide: ['$items.gstRate', 100] }] }],
            },
            2,
          ],
        },

        cgstPercent: { $divide: ['$items.gstRate', 2] },
        sgstPercent: { $divide: ['$items.gstRate', 2] },

        // CGST = gstAmount / 2, where gstAmount = total - taxableValue
        cgstAmount: {
          $round: [
            {
              $divide: [
                {
                  $subtract: [
                    '$items.total',
                    {
                      $divide: ['$items.total', { $add: [1, { $divide: ['$items.gstRate', 100] }] }],
                    },
                  ],
                },
                2,
              ],
            },
            2,
          ],
        },

        // SGST = same as CGST (half of total GST)
        sgstAmount: {
          $round: [
            {
              $divide: [
                {
                  $subtract: [
                    '$items.total',
                    {
                      $divide: ['$items.total', { $add: [1, { $divide: ['$items.gstRate', 100] }] }],
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

  const matchStage = {};
  if (store) {
    matchStage.store = store;
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

    {
      $project: {
        purchaseDate: '$date',
        billNumber: '$invoiceNumber',

        vendorName: {
          $ifNull: ['$vendorName', 'Unknown Vendor'],
        },

        vendorGst: {
          $ifNull: ['$vendorGstNumber', '-'],
        },

        item: '$items.name',
        hsn: '$items.hsn',
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

        billAmount: '$grandTotal',
      },
    },

    { $sort: { purchaseDate: 1, billNumber: 1 } },
  ]);

  return result;
};

export const getProfitLossReport = async (filters = {}) => {
  const { store, startDate, endDate } = filters;

  const matchStage = {
    status: 'active',
  };

  if (store) {
    matchStage.store = store;
  }

  if (startDate && endDate) {
    matchStage.invoiceDate = {
      $gte: startDate,
      $lte: endDate,
    };
  }

  const result = await Invoice.aggregate([
    { $match: matchStage },

    { $unwind: '$items' },

    {
      $addFields: {
        costPrice: {
          $multiply: ['$items.quantity', '$items.sellingPrice'],
        },
      },
    },

    {
      $group: {
        _id: '$_id',

        invoiceDate: { $first: '$invoiceDate' },
        invoiceNumber: { $first: '$invoiceNumber' },
        customerName: { $first: '$customerName' },
        customerMobile: { $first: '$customerMobile' },

        invoiceAmount: { $first: '$grandTotal' },

        totalCost: { $sum: '$costPrice' },
      },
    },

    {
      $project: {
        invoiceDate: 1,
        invoiceNumber: 1,

        customerDescription: {
          $concat: [{ $ifNull: ['$customerName', 'Cash Customer'] }, ' , ', { $ifNull: ['$customerMobile', '-'] }],
        },

        invoiceAmount: 1,

        profitLoss: {
          $subtract: ['$invoiceAmount', '$totalCost'],
        },
      },
    },

    { $sort: { invoiceDate: 1 } },
  ]);

  return result;
};

export const getItemStockReport = async (filters = {}) => {
  const { store, itemName, asOnDate } = filters;

  const matchStage = {
    store,
  };

  if (asOnDate) {
    matchStage.date = { $lte: asOnDate };
  }

  const pipeline = [
    { $match: matchStage },

    { $unwind: '$items' },

    ...(itemName
      ? [
          {
            $match: {
              'items.name': {
                $regex: itemName,
                $options: 'i',
              },
            },
          },
        ]
      : []),

    {
      $group: {
        _id: '$items.product',

        itemDescription: { $first: '$items.name' },

        quantity: {
          $sum: '$items.quantity',
        },

        avgRate: {
          $avg: '$items.rate',
        },
      },
    },

    {
      $project: {
        _id: 0,

        itemDescription: 1,

        quantity: 1,

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

    { $sort: { itemDescription: 1 } },
  ];

  const result = await Purchase.aggregate(pipeline);

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
