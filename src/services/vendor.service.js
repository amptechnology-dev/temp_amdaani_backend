import { Vendor } from '../models/vendor.model.js';
import { handleDuplicateKeyError } from '../utils/dbErrorHandler.js';
import { Purchase } from '../models/purchase.model.js';

export const createVendor = async (data, session = null) => {
  try {
    const vendor = new Vendor(data);
    return await vendor.save(session ? { session } : undefined);
  } catch (err) {
    handleDuplicateKeyError(err, Vendor);
  }
};

export const updateVendorById = async (id, data, session = null) => {
  try {
    return await Vendor.findByIdAndUpdate(id, data, { session, new: true, runValidators: true });
  } catch (err) {
    handleDuplicateKeyError(err, Vendor);
  }
};

export const getVendorById = async (id) => {
  return Vendor.findById(id);
};

export const queryVendor = async (filters = {}, options = {}) => {
  const { page = 1, limit = 20, sortBy = 'createdAt', order = 'desc' } = options;
  const sort = { [sortBy]: order === 'desc' ? -1 : 1 };

  const paginationOptions = {
    page,
    limit,
    sort,
    lean: true,
  };
  const aggregate = Vendor.aggregate([
    { $match: filters },
    /*
    {
      $lookup: {
        from: 'invoices',
        let: { customerId: '$_id' },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ['$customer', '$$customerId'] }, { $eq: ['$status', 'active'] }] } } },
          { $count: 'count' },
        ],
        as: 'invoiceStats',
      },
    },
    {
      $addFields: {
        totalInvoices: {
          $ifNull: [{ $arrayElemAt: ['$invoiceStats.count', 0] }, 0],
        },
      },
    },
    { $project: { invoiceStats: 0 } }, // hide intermediate field
    */
  ]);
  return Vendor.aggregatePaginate(aggregate, paginationOptions);
};

export const deleteVendorById = async (id) => {
  return Vendor.findByIdAndDelete(id);
};

export const findOrCreateVendor = async (store, data, session = null) => {
  if (data._id) return data._id;
  if (data.mobile === '') return null;

  const existingVendor = await Vendor.exists({ store, mobile: data.mobile }).session(session);
  if (existingVendor) return existingVendor._id;

  const newVendor = await createVendor({ ...data, store }, session);
  return newVendor._id;
};

export const getVendorsWithDue = async (storeId, options = {}) => {
  const { page = 1, limit = 20, sortBy = 'totalDue', order = 'desc' } = options;
  const sort = { [sortBy]: order === 'desc' ? -1 : 1 };

  const aggregate = Vendor.aggregate([
    { $match: { store: storeId } },
    {
      $lookup: {
        from: 'purchases',
        let: { vendorId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ['$vendor', '$$vendorId'] }, { $gt: ['$amountDue', 0] }, { $eq: ['$status', 'active'] }],
              },
            },
          },
          {
            $group: {
              _id: null,
              totalDue: { $sum: '$amountDue' },
              purchaseCount: { $sum: 1 },
            },
          },
        ],
        as: 'dueSummary',
      },
    },
    {
      $addFields: {
        totalDue: { $ifNull: [{ $arrayElemAt: ['$dueSummary.totalDue', 0] }, 0] },
        pendingPurchaseCount: { $ifNull: [{ $arrayElemAt: ['$dueSummary.purchaseCount', 0] }, 0] },
      },
    },
    { $match: { totalDue: { $gt: 0 } } },
    { $project: { dueSummary: 0 } },
  ]);

  return Vendor.aggregatePaginate(aggregate, { page, limit, sort, lean: true });
};

export const getVendorDueDetails = async (vendorId) => {
  const vendor = await getVendorById(vendorId);
  if (!vendor) return null;

  const purchases = await Purchase.find({
    vendor: vendorId,
    amountDue: { $gt: 0 },
    status: 'active',
  }).select('invoiceNumber date grandTotal amountPaid amountDue paymentStatus');

  return { vendor, purchases };
};
