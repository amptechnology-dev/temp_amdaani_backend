import { Vendor } from '../models/vendor.model.js';
import { handleDuplicateKeyError } from '../utils/dbErrorHandler.js';
import { Purchase } from '../models/purchase.model.js';

export const createVendor = async (data, session = null) => {
  // No try/catch — let errors bubble up naturally
  const vendor = new Vendor(data);
  const saved = await vendor.save(session ? { session } : undefined);
  console.log('vendor saved to DB:', saved._id);
  return saved;
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
  console.log('findOrCreateVendor called:', {
    _id: data._id,
    mobile: data.mobile,
    name: data.name,
  });

  // Step 1: valid ObjectId passed → use it directly
  if (data._id && mongoose.Types.ObjectId.isValid(String(data._id))) {
    console.log('✅ using existing _id:', data._id);
    return data._id;
  }

  // Step 2: no mobile → cannot find or create
  if (!data.mobile || String(data.mobile).trim() === '') {
    console.warn('❌ no mobile provided');
    return null;
  }

  // Step 3: no name → cannot create
  if (!data.name || String(data.name).trim() === '') {
    console.warn('❌ no name provided');
    return null;
  }

  const cleanMobile = String(data.mobile).trim().replace(/\D/g, '');
  console.log('searching vendor with cleanMobile:', cleanMobile);

  // Step 4: find existing vendor by mobile
  const existingVendor = await Vendor.findOne({
    store,
    mobile: { $regex: cleanMobile, $options: 'i' },
  }).lean();

  if (existingVendor) {
    console.log('✅ found existing vendor:', existingVendor._id);
    return existingVendor._id;
  }

  // Step 5: create new vendor
  console.log('creating new vendor with:', { name: data.name, mobile: data.mobile });
  const newVendor = await createVendor(
    {
      name: String(data.name).trim(),
      mobile: String(data.mobile).trim(),
      address: data.address || '',
      city: data.city || '',
      state: data.state || '',
      country: data.country || 'India',
      postalCode: data.postalCode || '',
      gstNumber: data.gstNumber || '',
      panNumber: data.panNumber || '',
      store,
      isActive: true,
    },
    session
  );

  console.log('✅ new vendor created:', newVendor?._id);
  return newVendor?._id ?? null;
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
