import { Product } from '../models/product.model.js';
import { Store } from '../models/store.model.js';
import { Invoice } from '../models/invoice.model.js';
// import { ApiError } from '../utils/responseHandler.js';
import { handleDuplicateKeyError } from '../utils/dbErrorHandler.js';
import { StockTransactionType } from '../config/constants.js';
import { StockTransaction } from '../models/stockTransaction.model.js';
import mongoose from 'mongoose';

export const createProduct = async (data, session = null) => {
  try {
    const { openingStock = 0, value = 0, ...productData } = data;

    // Find store
    const store = await Store.findById(productData.store).session(session);

    if (!store) {
      throw new Error('Store not found');
    }

    const currentFY = store.currentFinancialYear;

    if (!currentFY) {
      throw new Error('Current financial year not found');
    }

    // Always create FY stock entry
    productData.financialYearStocks = [
      {
        financialYear: currentFY,
        stock: Number(openingStock) || 0,
        value: Number(value) || 0,
      },
    ];

    // Set current stock
    productData.currentStock = Number(openingStock) || 0;

    // productData.costPrice = value && openingStock ? Number(value) / Number(openingStock) : 0;

    // Create product
    const product = new Product(productData);

    // console.log('product data', JSON.stringify(product));

    // const stockTransaction = new StockTransaction({
    //   product: product._id,
    //   store: product.store,
    //   data: product.
    // })

    const saveData = await product.save(session ? { session } : undefined);

    const safeTotalAmount = Number((Number(value) || 0 * Math.abs(Number(openingStock) || 0)).toFixed(2));

    const stockTransaction = new StockTransaction({
      product: saveData._id,
      store: product.store,
      date: product.createdAt,
      transactionType: StockTransactionType.OPENINGSTOCK,
      quantity: Number(openingStock) || 0,
      direction: 'IN',
      rate: Number(value) || 0,
      totalAmount: safeTotalAmount,
    });
    console.log('product data', JSON.stringify(saveData));
    await stockTransaction.save({ session });
    return saveData;
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
          {
            $match: {
              $expr: {
                $and: [{ $eq: ['$items.product', '$$productId'] }, { $eq: ['$status', 'active'] }],
              },
            },
          },
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
    // FIX: use $project with explicit 0 only for invoiceStats
    // all other fields are preserved with $$ROOT trick
    {
      $project: {
        invoiceStats: 0,
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
  const product = await Product.findById(id).lean();

  if (!product) {
    return null;
  }

  const store = await Store.findById(product.store).select('currentFinancialYear').lean();

  const currentFY = store?.currentFinancialYear;

  const financialYearStock = product.financialYearStocks?.find((fy) => fy.financialYear === currentFY) || {
    financialYear: currentFY,
    stock: 0,
    value: 0,
  };

  delete product.financialYearStocks;

  return {
    ...product,
    financialYearStock,
  };
};

export const updateProductById = async (id, data, session = null) => {
  try {
    const { openingStock, value, ...updateData } = data;
    const product = await Product.findById(id).session(session);
    if (!product) {
      return null;
    }

    // ==========================
    // UPDATE CURRENT FY OPENING STOCK
    // ==========================
    if (openingStock !== undefined || value !== undefined) {
      const store = await Store.findById(product.store).session(session);

      if (!store) {
        throw new Error('Store not found');
      }

      const currentFY = store.currentFinancialYear;

      if (!currentFY) {
        throw new Error('Current financial year not found');
      }

      const fyIndex = product.financialYearStocks.findIndex((fy) => fy.financialYear === currentFY);

      if (fyIndex > -1) {
        if (openingStock !== undefined) {
          product.financialYearStocks[fyIndex].stock = Number(openingStock) || 0;
        }

        if (value !== undefined) {
          product.financialYearStocks[fyIndex].value = Number(value) || 0;
        }
      } else {
        product.financialYearStocks.push({
          financialYear: currentFY,
          stock: Number(openingStock) || 0,
          value: Number(value) || 0,
        });
      }

      // current stock sync with opening stock
      if (openingStock !== undefined) {
        product.currentStock = Number(openingStock) || 0;
      }
    }

    // ==========================
    // UPDATE OTHER FIELDS
    // ==========================
    Object.assign(product, updateData);

    const saveData = await product.save({ session });

    await StockTransaction.deleteMany(
      {
        product: saveData._id,
        transactionType: StockTransactionType.OPENINGSTOCK, // only delete SALE txns, not prior reversals
      },
      { session }
    );

    const safeTotalAmount = Number((Number(value) || 0 * Math.abs(Number(openingStock) || 0)).toFixed(2));

    const stockTransaction = new StockTransaction({
      product: saveData._id,
      store: product.store,
      date: product.createdAt,
      transactionType: StockTransactionType.OPENINGSTOCK,
      quantity: Number(openingStock) || 0,
      direction: 'IN',
      rate: Number(value) || 0,
      totalAmount: safeTotalAmount,
    });

    await stockTransaction.save({ session });

    console.log('tras', stockTransaction);

    return saveData;
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

export const getAllProductsWithSales = async (storeId, startDate, endDate, search = '') => {
  const start = startDate instanceof Date ? startDate : null;
  const end = endDate instanceof Date ? endDate : null;

  if (end) {
    end.setHours(23, 59, 59, 999);
  }

  return Product.aggregate([
    {
      $match: {
        store: new mongoose.Types.ObjectId(storeId),
        name: { $regex: search, $options: 'i' },
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
                $eq: ['$items.product', '$$productId'],
              },
            },
          },

          {
            $match: {
              store: new mongoose.Types.ObjectId(storeId),
              status: 'active',
              ...(start && end
                ? { invoiceDate: { $gte: start, $lte: end } }
                : start
                  ? { invoiceDate: { $gte: start } }
                  : end
                    ? { invoiceDate: { $lte: end } }
                    : {}),
            },
          },

          {
            $group: {
              _id: null,
              totalQuantity: { $sum: '$items.quantity' },
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

    {
      $match: {
        totalSold: { $gt: 0 },
      },
    },

    {
      $sort: {
        totalRevenue: -1,
      },
    },
  ]);
};

const adjustProductStockForSale = async (data, session = null) => {
  const {
    productId,
    date = new Date(),
    transactionType = StockTransactionType.SALE,

    quantity,
    rate = 0,

    saleId = null,
    purchaseId = null, // rarely needed on sale side, kept for consistency

    salePrice,
    purchasePrice,
    sellingDiscount,
    purchaseDiscount,

    remarks = '',

    hsn,
    isTaxInclusive = false,
    isPurchaseTaxInclusive = false,
    gstRate,
  } = data;

  // ==========================
  // FIND PRODUCT
  // ==========================
  const product = await Product.findById(productId).session(session);

  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }

  // ==========================
  // SAFE NUMERIC PARSING
  // ==========================
  const safeRate = Number(rate ?? 0);
  const safeQuantity = Number(quantity ?? 0);
  const safeTotalAmount = Number((safeRate * Math.abs(safeQuantity)).toFixed(2));

  if (isNaN(safeQuantity) || isNaN(safeRate) || isNaN(safeTotalAmount)) {
    throw new Error(`Invalid numeric values for product ${productId}`);
  }

  console.log('a', safeQuantity);

  // ==========================
  // UPDATE CURRENT STOCK
  // ==========================
  product.currentStock += safeQuantity; // negative quantity = OUT (deduct on sale)

  // ==========================
  // UPDATE PRODUCT INFO
  // ==========================
  if (salePrice !== undefined) {
    product.sellingPrice = salePrice;
  }

  if (purchasePrice !== undefined) {
    product.costPrice = purchasePrice;
  }

  if (sellingDiscount !== undefined) {
    product.discountPrice = sellingDiscount;
  }

  if (purchaseDiscount !== undefined) {
    product.purchaseDiscount = purchaseDiscount;
  }

  if (hsn) {
    product.hsn = hsn;
  }

  if (isTaxInclusive !== undefined) {
    product.isTaxInclusive = isTaxInclusive;
  }

  if (isPurchaseTaxInclusive !== undefined) {
    product.isPurchaseTaxInclusive = isPurchaseTaxInclusive;
  }

  if (gstRate !== undefined) {
    product.gstRate = gstRate;
    product.purchaseGstRate = gstRate;
  }

  // ==========================
  // SAVE PRODUCT
  // ==========================
  await product.save({ session });

  // ==========================
  // CREATE STOCK TRANSACTION
  // ==========================
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
    purchaseId,
    remarks,
  });

  // ==========================
  // SAVE TRANSACTION
  // ==========================
  return stockTransaction.save({ session });
};

export { adjustProductStockForSale };

export const reverseStockAfterPurchaseDelete = async (purchase, session = null) => {
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
        quantity: -item.quantity, // negative to subtract stock
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

export const adjustProductStock = async (data, session = null) => {
  const {
    productId,
    date = new Date(),
    transactionType,

    quantity,
    rate = 0,

    batchId = null,
    purchaseId = null,
    saleId = null,

    purchasePrice,
    salePrice,
    sellingDiscount,
    purchaseDiscount,

    remarks = '',

    hsn,
    isTaxInclusive = false,
    isPurchaseTaxInclusive = false,
    gstRate,
  } = data;

  console.log('Adjusting stock for product', JSON.stringify(productId), 'with quantity', JSON.stringify(quantity));

  // ==========================
  // FIND PRODUCT
  // ==========================
  const product = await Product.findById(productId).session(session);

  if (!product) {
    throw new Error('Product not found');
  }

  // ==========================
  // UPDATE CURRENT STOCK
  // ==========================
  product.currentStock += quantity;

  // ==========================
  // UPDATE PRODUCT INFO
  // ==========================
  if (purchasePrice !== undefined) {
    product.costPrice = purchasePrice;
  }

  if (salePrice !== undefined) {
    product.sellingPrice = salePrice;
  }

  if (sellingDiscount !== undefined) {
    product.discountPrice = sellingDiscount;
  }

  if (purchaseDiscount !== undefined) {
    product.purchaseDiscount = purchaseDiscount;
  }

  if (hsn) {
    product.hsn = hsn;
  }

  if (isTaxInclusive !== undefined) {
    product.isTaxInclusive = isTaxInclusive;
  }

  if (isPurchaseTaxInclusive !== undefined) {
    product.isPurchaseTaxInclusive = isPurchaseTaxInclusive;
  }

  if (gstRate !== undefined) {
    product.gstRate = gstRate;

    product.purchaseGstRate = gstRate;
  }

  // ==========================
  // SAVE PRODUCT
  // ==========================
  await product.save({
    session,
  });

  // ==========================
  // CREATE STOCK TRANSACTION
  // ==========================
  const stockTransaction = new StockTransaction({
    product: productId,

    store: product.store,

    batch: batchId,

    date,

    transactionType: transactionType || 'MANUAL',

    quantity: Math.abs(quantity),

    direction: quantity >= 0 ? 'IN' : 'OUT',

    rate,

    purchaseId,
    saleId,

    totalAmount: rate * Math.abs(quantity),

    remarks,
  });

  // ==========================
  // SAVE TRANSACTION
  // ==========================
  return await stockTransaction.save({
    session,
  });
};

export const getStockTransactionsByProduct = async (productId, filters = {}, options = {}) => {
  const { page = 1, limit = 20, sortBy = 'createdAt', order = 'desc' } = options;

  const sort = {
    [sortBy]: order === 'desc' ? -1 : 1,
  };

  const { startDate, endDate } = filters;

  const query = {
    store: filters.store,
    product: new mongoose.Types.ObjectId(productId),
  };

  // date filter only if exists
  if (startDate || endDate) {
    query.date = {};

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      query.date.$gte = start;
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.date.$lte = end;
    }
  }

  console.log(query);

  const aggregate = StockTransaction.aggregate([
    {
      $match: query,
    },
  ]);

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

  console.log('update stock ===> ', JSON.stringify(items));

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
        purchseDiscount: item.purchaseDiscount,
        isTaxInclusive: item.isTaxInclusive,
        isPurchaseTaxInclusive: item.isPurchaseTaxInclusive,
        hsn: item.hsn,
        gstRate: item.gstRate,
      },
      session
    );
  }
};

export const onlyupdateStockAfterPurchase = async (purchase, session = null) => {
  const { items = [], date } = purchase;
  if (!items.length) return;

  console.log('-items-->', JSON.stringify(items));

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
  const { items = [], date, _id: saleId } = sale;
  if (!items.length) return;

  console.log('reverse sale => ', items);

  // ✅ Delete old stock transactions tied to this sale
  await StockTransaction.deleteMany(
    {
      saleId,
      transactionType: StockTransactionType.SALE, // only delete SALE txns, not prior reversals
    },
    { session }
  );

  // ✅ Reverse each item by applying negative quantity
  for (const item of items) {
    await adjustProductStockForSale(
      {
        productId: item.product,
        date: date || new Date(),
        transactionType: StockTransactionType.SALE_REVERSE,
        quantity: item.previousQuantity ?? item.quantity, // 👈 negative to add stock back
        rate: item.rate ?? item.salePrice ?? 0,
        saleId,
        remarks: `Sale reversed for ${item.previousQuantity ?? item.quantity} units`,
      },
      session
    );
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

export const createupdateStockAfterSale = async (sale, session = null) => {
  const { items = [], store } = sale;
  if (!items.length) return;

  const stockEnabled = sale.storeSettings?.stockManagement ?? true;
  if (!stockEnabled) return;

  console.log('update stock sale ===> ', JSON.stringify(items));

  for (const item of items) {
    // item.product may be a populated Mongoose document, extract _id safely
    const productId = item.product?._id ?? item.product;
    if (!productId) continue;

    const quantity = Number(item.quantity ?? item.qty ?? 0);
    if (!quantity) continue;

    await adjustProductStockForSale(
      {
        productId,
        date: sale.invoiceDate || new Date(),
        transactionType: StockTransactionType.SALE,
        quantity: -quantity, // 👈 negative = OUT (opposite of purchase)
        rate: item.sellingPrice ?? item.rate ?? item.price ?? 0,
        saleId: sale._id,
        purchasePrice: item.costPrice ?? item.purchasePrice,
        salePrice: item.sellingPrice ?? item.rate,
        sellingDiscount: item.sellingDiscount,
        purchaseDiscount: item.purchaseDiscount,
        isTaxInclusive: item.isTaxInclusive,
        isPurchaseTaxInclusive: item.isPurchaseTaxInclusive,
        hsn: item.hsn,
        gstRate: item.gstRate,
        remarks: `Sale deducted for ${quantity} units`,
      },
      session
    );
  }
};

export const updateStockAfterSale = async (sale, session = null) => {
  const { items = [], store } = sale;
  if (!items.length) return;

  const stockEnabled = sale.storeSettings?.stockManagement ?? true;
  if (!stockEnabled) return;

  console.log('update stock sale ===> ', JSON.stringify(items));

  for (const item of items) {
    // item.product may be a populated Mongoose document, extract _id safely
    const productId = item.product?._id ?? item.product;
    if (!productId) continue;

    const quantity = Number(item.quantity ?? item.qty ?? 0);
    if (!quantity) continue;

    console.log('--->', quantity);

    console.log('productId', productId);

    await adjustProductStockForSale(
      {
        productId,
        date: sale.invoiceDate || new Date(),
        transactionType: StockTransactionType.SALE_REVERSE,
        quantity: -quantity, // 👈 negative = OUT (opposite of purchase)
        rate: item.sellingPrice ?? item.rate ?? item.price ?? 0,
        saleId: sale._id,
        purchasePrice: item.costPrice ?? item.purchasePrice,
        salePrice: item.sellingPrice ?? item.rate,
        sellingDiscount: item.sellingDiscount,
        purchaseDiscount: item.purchaseDiscount,
        isTaxInclusive: item.isTaxInclusive,
        isPurchaseTaxInclusive: item.isPurchaseTaxInclusive,
        hsn: item.hsn,
        gstRate: item.gstRate,
        remarks: `Sale deducted for ${quantity} units`,
      },
      session
    );
  }
};

export const carryForwardStockToNextFinancialYear = async (storeId) => {
  const store = await Store.findById(storeId);

  if (!store) {
    throw new ApiError(404, 'Store not found');
  }

  const currentFY = store.currentFinancialYear;

  if (!currentFY) {
    throw new ApiError(400, 'Current financial year not found');
  }

  // Generate next FY
  const [startYear, endYear] = currentFY.split('-').map(Number);

  const nextFY = `${startYear + 1}-${endYear + 1}`;

  // Get all products
  const products = await Product.find({
    store: storeId,
  });

  for (const product of products) {
    const alreadyExists = product.financialYearStocks.some((item) => item.financialYear === nextFY);

    // Skip if already exists
    if (alreadyExists) continue;

    // Add next FY opening stock
    product.financialYearStocks.push({
      financialYear: nextFY,
      stock: product.currentStock,
      value: product.costPrice && product.currentStock ? Number(product.costPrice) * Number(product.currentStock) : 0,
    });

    await product.save();
  }

  // Update store current FY
  store.currentFinancialYear = nextFY;

  await store.save();

  return {
    message: 'Stock carried forward successfully',
    currentFY,
    nextFY,
  };
};

export const getProductSuggestions = async (storeId, search = '') => {
  if (!search || !search.trim()) {
    return [];
  }

  return Product.find({
    store: new mongoose.Types.ObjectId(storeId),

    status: 'active',

    name: {
      $regex: search.trim(),
      $options: 'i',
    },
  })
    .select('_id name sku currentStock sellingPrice')
    .sort({
      name: 1,
    })
    .limit(10)
    .lean();
};
