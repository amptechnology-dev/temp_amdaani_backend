import { Customer } from '../models/customer.model.js';
import { handleDuplicateKeyError } from '../utils/dbErrorHandler.js';
import { Invoice } from '../models/invoice.model.js';

export const createCustomer = async (data, session = null) => {
  try {
    const customer = new Customer(data);
    return await customer.save(session ? { session } : undefined);
  } catch (err) {
    handleDuplicateKeyError(err, Customer);
  }
};

export const updateCustomerById = async (id, data, session = null) => {
  try {
    return await Customer.findByIdAndUpdate(id, data, { session, new: true, runValidators: true });
  } catch (err) {
    handleDuplicateKeyError(err, Customer);
  }
};

export const getCustomerById = async (id) => {
  return Customer.findById(id);
};

export const queryCustomer = async (filters = {}, options = {}) => {
  const { page = 1, limit = 20, sortBy = 'createdAt', order = 'desc' } = options;
  const sort = { [sortBy]: order === 'desc' ? -1 : 1 };

  const paginationOptions = {
    page,
    limit,
    sort,
    lean: true,
  };
  const aggregate = Customer.aggregate([
    { $match: filters },
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
  ]);
  return Customer.aggregatePaginate(aggregate, paginationOptions);
};

export const deleteCustomerById = async (id) => {
  return Customer.findByIdAndDelete(id);
};

export const findOrCreateCustomer = async (store, data, session = null) => {
  if (data._id) return data._id;
  if (data.mobile === '') return null;

  const existingCustomer = await Customer.exists({ store, mobile: data.mobile }).session(session);
  if (existingCustomer) return existingCustomer._id;

  const newCustomer = await createCustomer({ ...data, store }, session);
  return newCustomer._id;
};

export const getCustomersWithDue = async (storeId, options = {}) => {
  const { page = 1, limit = 20, sortBy = 'totalDue', order = 'desc' } = options;
  const sort = { [sortBy]: order === 'desc' ? -1 : 1 };

  const aggregate = Customer.aggregate([
    { $match: { store: storeId } },
    {
      $lookup: {
        from: 'invoices',
        let: { customerId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$customer', '$$customerId'] },
                  { $gt: ['$amountDue', 0] },
                  { $eq: ['$status', 'active'] },
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              totalDue: { $sum: '$amountDue' },
              invoiceCount: { $sum: 1 },
            },
          },
        ],
        as: 'dueSummary',
      },
    },
    {
      $addFields: {
        totalDue: { $ifNull: [{ $arrayElemAt: ['$dueSummary.totalDue', 0] }, 0] },
        pendingInvoiceCount: { $ifNull: [{ $arrayElemAt: ['$dueSummary.invoiceCount', 0] }, 0] },
      },
    },
    { $match: { totalDue: { $gt: 0 } } },
    { $project: { dueSummary: 0 } },
  ]);

  return Customer.aggregatePaginate(aggregate, { page, limit, sort, lean: true });
};

export const getCustomerDueDetails = async (customerId) => {
  const customer = await getCustomerById(customerId);
  if (!customer) return null;

  const invoices = await Invoice.find({ customer: customerId, amountDue: { $gt: 0 }, status: 'active' }).select(
    'invoiceNumber invoiceDate grandTotal amountPaid amountDue paymentStatus'
  );

  return { customer, invoices };
};
