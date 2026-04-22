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
  if (data._id) return data._id;

  const existingProduct = await Product.exists({ name: data.name, store }).session(session);
  if (existingProduct) return existingProduct._id;

  const newProduct = await createProduct({ ...data, store }, session);
  return newProduct._id;
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

export const updateStockAfterSale = async (sale, session = null) => {
  const { items = [], date } = sale;
  if (!items.length) return;

  for (const item of items) {
    await adjustProductStock(
      {
        productId: item.product,
        date: date || new Date(),
        transactionType: StockTransactionType.SALE,
        quantity: -item.quantity,
        rate: item.sellingPrice,
        batchId: item.batch,
        saleId: sale._id,
        salePrice: item.sellingPrice,
        // remarks: `Sale deducted for ${item.quantity} units`,
      },
      session
    );
  }
};
