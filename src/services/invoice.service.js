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

  console.log(items);

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
  const invoice = await Invoice.findById(id).populate('customer');
  if (!invoice) return null;

  const transactions = await getTransactionsByInvoice(id);
  return { ...invoice.toObject(), transactions };
};

export const queryInvoices = async (filter = {}, options = {}) => {
  const { page = 1, limit = 20, sortBy = "createdAt", order = "desc" } = options;

  const aggregate = Invoice.aggregate([
    {
      $match: filter,
    },
    {
      $lookup: {
        from: "stores",
        localField: "store",
        foreignField: "_id",
        as: "store",
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
        path: "$store",
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
        [sortBy]: order === "desc" ? -1 : 1,
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
  return Invoice.findOne({ store }).sort({ createdAt: -1 });
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

    { $unwind: "$items" },

    {
      $project: {
        date: "$invoiceDate",
        invoiceNumber: 1,
        product: "$items.name",
        productHsn: "$items.hsn",
        unit: "$items.unit",
        price: "$items.sellingPrice",
        quantity: "$items.quantity",
        discount: "$items.discount",
        gstRate: "$items.gstRate",

        gstAmount: {
          $round: [
            {
              $multiply: [
                "$items.total",
                { $divide: ["$items.gstRate", 100] }
              ]
            },
            2
          ]
        },

        lineTotal: "$items.total",
        grandTotal: "$grandTotal",
      },
    },

    { $sort: { date: 1, invoiceNumber: 1 } },
  ]);

  return result;
};

export const getGstSalesReport = async (filters = {}) => {

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

    { $unwind: "$items" },

    {
      $project: {
        invoiceDate: 1,
        invoiceNumber: 1,

        customerName: {
          $ifNull: ["$customerName", "Cash Customer"]
        },

        customerGst: {
          $ifNull: ["$customerGstNumber", "-"]
        },

        item: "$items.name",
        hsn: "$items.hsn",
        unit: "$items.unit",

        quantity: "$items.quantity",

        taxableValue: "$items.total",

        cgstPercent: {
          $divide: ["$items.gstRate", 2]
        },

        sgstPercent: {
          $divide: ["$items.gstRate", 2]
        },

        cgstAmount: {
          $round: [
            {
              $divide: [
                {
                  $multiply: [
                    "$items.total",
                    "$items.gstRate"
                  ]
                },
                200
              ]
            },
            2
          ]
        },

        sgstAmount: {
          $round: [
            {
              $divide: [
                {
                  $multiply: [
                    "$items.total",
                    "$items.gstRate"
                  ]
                },
                200
              ]
            },
            2
          ]
        },

        invoiceAmount: "$grandTotal",
      },
    },

    { $sort: { invoiceDate: 1, invoiceNumber: 1 } },
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

    { $unwind: "$items" },

    {
      $project: {

        purchaseDate: "$date",
        billNumber: "$invoiceNumber",

        vendorName: {
          $ifNull: ["$vendorName", "Unknown Vendor"]
        },

        vendorGst: {
          $ifNull: ["$vendorGstNumber", "-"]
        },

        item: "$items.name",
        hsn: "$items.hsn",
        unit: "$items.unit",

        quantity: "$items.quantity",

        taxableValue: "$items.total",

        cgstPercent: {
          $divide: ["$items.gstRate", 2]
        },

        sgstPercent: {
          $divide: ["$items.gstRate", 2]
        },

        cgstAmount: {
          $round: [
            {
              $divide: [
                {
                  $multiply: [
                    "$items.total",
                    "$items.gstRate"
                  ]
                },
                200
              ]
            },
            2
          ]
        },

        sgstAmount: {
          $round: [
            {
              $divide: [
                {
                  $multiply: [
                    "$items.total",
                    "$items.gstRate"
                  ]
                },
                200
              ]
            },
            2
          ]
        },

        billAmount: "$grandTotal",

      }
    },

    { $sort: { purchaseDate: 1, billNumber: 1 } }

  ]);

  return result;
};

export const getProfitLossReport = async (filters = {}) => {

  const { store, startDate, endDate } = filters;

  const matchStage = {
    status: "active"
  };

  if (store) {
    matchStage.store = store;
  }

  if (startDate && endDate) {
    matchStage.invoiceDate = {
      $gte: startDate,
      $lte: endDate
    };
  }

  const result = await Invoice.aggregate([

    { $match: matchStage },

    { $unwind: "$items" },

    {
      $addFields: {
        costPrice: {
          $multiply: [
            "$items.quantity",
            "$items.sellingPrice"
          ]
        }
      }
    },

    {
      $group: {

        _id: "$_id",

        invoiceDate: { $first: "$invoiceDate" },
        invoiceNumber: { $first: "$invoiceNumber" },
        customerName: { $first: "$customerName" },
        customerMobile: { $first: "$customerMobile" },

        invoiceAmount: { $first: "$grandTotal" },

        totalCost: { $sum: "$costPrice" }

      }
    },

    {
      $project: {

        invoiceDate: 1,
        invoiceNumber: 1,

        customerDescription: {
          $concat: [
            { $ifNull: ["$customerName", "Cash Customer"] },
            " , ",
            { $ifNull: ["$customerMobile", "-"] }
          ]
        },

        invoiceAmount: 1,

        profitLoss: {
          $subtract: [
            "$invoiceAmount",
            "$totalCost"
          ]
        }

      }
    },

    { $sort: { invoiceDate: 1 } }

  ]);

  return result;

};

export const getItemStockReport = async (filters = {}) => {

  const { store, itemName, asOnDate } = filters;

  const matchStage = {
    store
  };

  if (asOnDate) {
    matchStage.date = { $lte: asOnDate };
  }

  const pipeline = [
    { $match: matchStage },

    { $unwind: "$items" },

    ...(itemName
      ? [
          {
            $match: {
              "items.name": {
                $regex: itemName,
                $options: "i"
              }
            }
          }
        ]
      : []),

    {
      $group: {

        _id: "$items.product",

        itemDescription: { $first: "$items.name" },

        quantity: {
          $sum: "$items.quantity"
        },

        avgRate: {
          $avg: "$items.rate"
        }

      }
    },

    {
      $project: {

        _id: 0,

        itemDescription: 1,

        quantity: 1,

        itemValue: {
          $round: [
            {
              $multiply: [
                "$quantity",
                "$avgRate"
              ]
            },
            2
          ]
        }

      }
    },

    { $sort: { itemDescription: 1 } }

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
