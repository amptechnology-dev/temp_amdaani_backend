import { Product } from '../models/product.model.js';
// import { ApiError } from '../utils/responseHandler.js';
import { handleDuplicateKeyError } from '../utils/dbErrorHandler.js';
import { StockTransactionType } from '../config/constants.js';
import { StockTransaction } from '../models/stockTransaction.model.js';
import mongoose from 'mongoose';

export const createProduct = async (data, session = null) => {
  try {
    const product = new Product(data);
    console.log(JSON.stringify(data));
    return await product.save(session ? { session } : undefined);
  } catch (error) {
    handleDuplicateKeyError(error, Product);
  }
};

export const queryProduct = async (filters = {}, options = {}) => {
  const { page = 1, limit = 20, sortBy = 'createdAt', order = 'desc' } = options;
  const sort = { [sortBy]: order === 'desc' ? -1 : 1 };

  const aggregate = Product.aggregate([
    { $match: filters },
    {
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        as: 'category',
        pipeline: [{ $project: { name: 1 } }],
      },
    },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'invoices',
        let: { productId: '$_id' },
        pipeline: [
          { $unwind: '$items' },
          { $match: { $expr: { $and: [{ $eq: ['$items.product', '$$productId'] }, { $eq: ['$status', 'active'] }] } } },
          {
            $group: {
              _id: '$$productId',
              totalQuantity: { $sum: '$items.quantity' },
            },
          },
        ],
        as: 'invoiceStats',
      },
    },
    {
      $addFields: {
        sellCount: {
          $ifNull: [{ $arrayElemAt: ['$invoiceStats.totalQuantity', 0] }, 0],
        },
      },
    },
    {
      $project: {
        invoiceStats: 0, // hide temporary lookup field
      },
    },
  ]);

  const paginationOptions = {
    page,
    limit,
    sort,
    lean: true,
    leanWithId: false,
  };
  return Product.aggregatePaginate(aggregate, paginationOptions);
};

export const getProductById = async (id) => {
  return Product.findById(id);
};

export const updateProductById = async (id, data, session = null) => {
  try {
    return Product.findByIdAndUpdate(id, data, { session, new: true, runValidators: true });
  } catch (error) {
    handleDuplicateKeyError(error, Product);
  }
};

export const deleteProductById = async (id) => {
  //TODO: Can not delete product if it has transactions
  return Product.findByIdAndDelete(id);
};

export const findOrCreateProduct = async (store, data, session = null) => {
  // ✅ If product ID already provided, just use it — never update it
  if (data._id) return data._id;

  // ✅ If product exists by name, return its ID — never update it
  const existingProduct = await Product.exists({ name: data.name, store }).session(session);
  if (existingProduct) return existingProduct._id;

  // ✅ No product found — return null instead of creating one
  // The invoice item already has all the data it needs (name, price, gstRate etc.)
  return null;
};

export const getAllProductsWithSales = async (storeId, startDate, endDate) => {
  const matchConditions = [{ $eq: ['$status', 'active'] }];

  if (startDate) {
    matchConditions.push({
      $gte: ['$invoiceDate', new Date(startDate)],
    });
  }

  if (endDate) {
    matchConditions.push({
      $lte: ['$invoiceDate', new Date(endDate)],
    });
  }

  return Product.aggregate([
    {
      $match: {
        store: storeId,
      },
    },

    {
      $lookup: {
        from: 'invoices',
        let: { productId: '$_id' },
        pipeline: [
          { $unwind: '$items' },

          {
            $match: {
              $expr: {
                $and: [...matchConditions, { $eq: ['$items.product', '$$productId'] }],
              },
            },
          },

          {
            $group: {
              _id: null,
              totalQuantity: {
                $sum: '$items.quantity',
              },
              totalRevenue: {
                $sum: {
                  $multiply: ['$items.quantity', '$items.sellingPrice'],
                },
              },
            },
          },
        ],
        as: 'salesData',
      },
    },

    {
      $project: {
        name: 1,
        sku: 1,
        hsn: 1,
        unit: 1,
        sellingPrice: 1,

        totalSold: {
          $ifNull: [{ $arrayElemAt: ['$salesData.totalQuantity', 0] }, 0],
        },

        totalRevenue: {
          $ifNull: [{ $arrayElemAt: ['$salesData.totalRevenue', 0] }, 0],
        },
      },
    },

    { $sort: { totalRevenue: -1 } },
  ]);
};

const adjustProductStockForSale = async (data, session = null) => {
  const {
    productId,
    date = new Date(),
    transactionType = StockTransactionType.SALE,
    quantity, // should be negative for OUT
    rate,
    saleId = null,
    remarks = '',
  } = data;

  const product = await Product.findById(productId).session(session);
  if (!product) return;

  // ✅ Safe numeric guards
  const safeRate = Number(rate ?? 0);
  const safeQuantity = Number(quantity ?? 0);
  const safeTotalAmount = Number((safeRate * Math.abs(safeQuantity)).toFixed(2));

  if (isNaN(safeQuantity) || isNaN(safeRate) || isNaN(safeTotalAmount)) {
    console.error('❌ Invalid stock values for sale item:', data);
    throw new Error(`Invalid numeric values in stock transaction for product ${productId}`);
  }

  // ✅ Update stock level only — no price fields touched
  product.currentStock = product.currentStock + safeQuantity;
  await product.save({ session });

  // ✅ Record stock transaction with rate + totalAmount
  const stockTransaction = new StockTransaction({
    product: productId,
    store: product.store,
    date,
    transactionType,
    quantity: Math.abs(safeQuantity),
    direction: safeQuantity >= 0 ? 'IN' : 'OUT',
    rate: safeRate,
    totalAmount: safeTotalAmount,
    saleId,
    remarks,
  });

  return stockTransaction.save({ session });
};

export const adjustProductStock = async (data, session = null) => {
  const {
    productId,
    date = new Date(),
    transactionType = StockTransactionType.ADJUSTMENT,
    quantity,
    rate,
    batchId = null,
    purchaseId = null,
    saleId = null,
    purchasePrice,
    salePrice,
    sellingDiscount,
    remarks = '',
  } = data;

  const product = await Product.findById(productId).session(session);
  if (!product) return;

  // Calculate new stock value
  const newStock = product.currentStock + quantity;

  // Update product fields
  product.currentStock = newStock;
  if (purchasePrice) product.lastPurchasePrice = purchasePrice;
  if (salePrice) product.sellingPrice = salePrice;
  if (sellingDiscount) product.discountPrice = sellingDiscount;
  await product.save({ session });

  // Record stock transaction
  const stockTransaction = new StockTransaction({
    product: productId,
    store: product.store,
    batch: batchId,
    date,
    transactionType,
    quantity: Math.abs(quantity),
    direction: quantity >= 0 ? 'IN' : 'OUT',
    rate,
    purchaseId,
    saleId,
    totalAmount: rate * Math.abs(quantity),
    remarks,
  });
  return stockTransaction.save({ session });
};

export const getStockTransactionsByProduct = async (productId, filters = {}, options = {}) => {
  const { page = 1, limit = 20, sortBy = 'createdAt', order = 'desc' } = options;
  const sort = { [sortBy]: order === 'desc' ? -1 : 1 };

  const { startDate, endDate } = filters;
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const query = {
    store: filters.store,
    product: new mongoose.Types.ObjectId(productId),
    date: { ...(startDate && { $gte: start }), ...(endDate && { $lte: end }) },
  };
  // Execute aggregate query with pagination
  const aggregate = StockTransaction.aggregate([{ $match: query }]);

  const paginationOptions = {
    page,
    limit,
    sort,
    lean: true,
    leanWithId: false,
  };
  return StockTransaction.aggregatePaginate(aggregate, paginationOptions);
};

export const updateStockAfterPurchase = async (purchase, session = null) => {
  const { items = [], date } = purchase;
  if (!items.length) return;

  for (const item of items) {
    await adjustProductStock(
      {
        productId: item.product,
        date: date || new Date(),
        transactionType: StockTransactionType.PURCHASE,
        quantity: item.quantity,
        rate: item.rate,
        batchId: item.batch,
        purchaseId: purchase._id,
        purchasePrice: item.rate,
        remarks: `Purchase added for ${item.quantity} units`,
        salePrice: item.sellingPrice,
        sellingDiscount: item.sellingDiscount,
      },
      session
    );
  }
};

export const reverseStockAfterSale = async (sale, session = null) => {
  const saleId = sale._id;

  // Find all stock transactions for this sale
  const transactions = await StockTransaction.find({ saleId }).session(session);
  if (!transactions.length) return;

  for (const txn of transactions) {
    const product = await Product.findById(txn.product).session(session);
    if (!product) continue;

    // Reverse the stock: if original was OUT (negative), we add back; if IN, we subtract
    const reversalQuantity = txn.direction === 'OUT' ? txn.quantity : -txn.quantity;
    product.currentStock = product.currentStock + reversalQuantity;
    await product.save({ session });

    // Record a reversal transaction for audit trail
    const reversalTxn = new StockTransaction({
      product: txn.product,
      store: txn.store,
      date: new Date(),
      transactionType: StockTransactionType.ADJUSTMENT,
      quantity: txn.quantity,
      direction: txn.direction === 'OUT' ? 'IN' : 'OUT', // flip direction
      rate: txn.rate,
      totalAmount: txn.totalAmount,
      saleId,
      remarks: `Reversal of sale transaction for invoice edit`,
    });

    await reversalTxn.save({ session });

    // Mark original transaction as reversed
    txn.reversed = true;
    txn.remarks = (txn.remarks || '') + ' [REVERSED]';
    await txn.save({ session });
  }
};

// export const updateStockAfterSale = async (sale, session = null) => {
//   const { items = [], store } = sale;
//   if (!items.length) return;

//   // ✅ Skip stock update entirely if store has stock management disabled
//   const storeSettings = sale.settings || {};
//   if (!storeSettings.stockManagement) return;

//   for (const item of items) {
//     // ✅ Skip items with no linked product (inline-only items)
//     if (!item.product) continue;

//     await adjustProductStock(
//       {
//         productId: item.product,
//         date: sale.invoiceDate || new Date(),
//         transactionType: StockTransactionType.SALE,
//         quantity: -item.quantity,
//         // ✅ Do NOT pass rate/salePrice/sellingPrice — prevents price update on Product table
//         saleId: sale._id,
//         remarks: `Sale deducted for ${item.quantity} units`,
//       },
//       session
//     );
//   }
// };

export const updateStockAfterSale = async (sale, session = null) => {
  const { items = [], store } = sale;
  if (!items.length) return;

  const storeSettings = sale.settings || {};
  if (!storeSettings.stockManagement) return;

  for (const item of items) {
    if (!item.product) continue;

    const quantity = Number(item.quantity ?? item.qty ?? 0);
    const rate = Number(item.sellingPrice ?? item.rate ?? item.price ?? 0);

    if (!quantity) continue; // skip zero-qty items

    await adjustProductStockForSale(
      {
        productId: item.product,
        date: sale.invoiceDate || new Date(),
        transactionType: StockTransactionType.SALE,
        quantity: -quantity, // ✅ negative = OUT
        rate, // ✅ rate now passed
        saleId: sale._id,
        remarks: `Sale deducted for ${quantity} units`,
      },
      session
    );
  }
};
