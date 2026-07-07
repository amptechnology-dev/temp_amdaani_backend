import mongoose from 'mongoose';
import { Order } from '../models/order.model.js';
import { Product } from '../models/product.model.js';
import { Customer } from '../models/customer.model.js';
import { ApiError } from '../utils/responseHandler.js';
import { handleDuplicateKeyError } from '../utils/dbErrorHandler.js';
import { createInvoice } from './invoice.service.js';

export const createOrder = async (body) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // ===========================
    // Customer Validation
    // ===========================
    const customer = await Customer.findOne({
      _id: body.customer,
      store: body.store,
      isActive: true,
    }).session(session);

    if (!customer) {
      throw new ApiError(404, 'Customer not found');
    }

    // ===========================
    // Duplicate Order Number Check
    // ===========================
    const existingOrder = await Order.findOne({
      store: body.store,
      orderNumber: body.orderNumber,
    }).session(session);

    if (existingOrder) {
      throw new ApiError(400, 'Order number already exists');
    }

    body.customerName = customer.name;
    body.customerMobile = customer.mobile;
    body.customerAddress = customer.address;
    body.customerGstNumber = customer.gstNumber;

    const orderItems = [];

    for (const item of body.items) {
      const product = await Product.findOne({
        _id: item.product,
        store: body.store,
      }).session(session);

      if (!product) {
        throw new ApiError(404, `Product not found`);
      }

      const total = item.quantity * item.sellingPrice;

      orderItems.push({
        product: product._id,

        // Product Snapshot
        name: product.name,
        hsn: product.hsn,
        unit: product.unit,
        gstRate: product.gstRate,
        isTaxInclusive: product.isTaxInclusive,

        // User Input
        quantity: item.quantity,
        sellingPrice: item.sellingPrice,

        discount: 0,

        total,
      });
    }

    const order = await Order.create(
      [
        {
          ...body,
          items: orderItems,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    return order[0];
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

export const updateOrder = async (orderId, data) => {
  const { items = [] } = data;

  if (!items.length) {
    throw new ApiError(400, 'Invalid order items!', {
      source: 'body',
      field: 'items',
      message: 'Order must have at least one item',
    });
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const order = await Order.findById(orderId).session(session);

    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    // Customer Validation
    const customer = await Customer.findOne({
      _id: data.customer,
      store: order.store,
      isActive: true,
    }).session(session);

    if (!customer) {
      throw new ApiError(404, 'Customer not found');
    }

    // Duplicate Order Number Check (optional)
    const existingOrder = await Order.findOne({
      _id: { $ne: orderId },
      store: order.store,
      orderNumber: data.orderNumber,
    }).session(session);

    if (existingOrder) {
      throw new ApiError(400, 'Order number already exists');
    }

    // Prepare Items
    const orderItems = [];

    for (const item of items) {
      const product = await Product.findOne({
        _id: item.product,
        store: order.store,
      }).session(session);

      if (!product) {
        throw new ApiError(404, 'Product not found');
      }

      const total = item.quantity * item.sellingPrice;

      orderItems.push({
        product: product._id,

        // Product Snapshot
        name: product.name,
        hsn: product.hsn,
        unit: product.unit,
        gstRate: product.gstRate,
        isTaxInclusive: product.isTaxInclusive,

        // User Input
        sellingPrice: item.sellingPrice,
        quantity: item.quantity,

        discount: 0,

        total,
      });
    }

    order.set({
      orderNumber: data.orderNumber,
      orderDate: data.orderDate,

      customer: customer._id,
      customerName: customer.name,
      customerMobile: customer.mobile,
      customerAddress: customer.address,
      customerGstNumber: customer.gstNumber,

      items: orderItems,

      edited: true,
    });

    await order.save({ session });

    await session.commitTransaction();

    return order;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

export const queryOrders = async (filter = {}, options = {}) => {
  const { page = 1, limit = 20, sortBy = 'createdAt', order = 'desc' } = options;

  if (filter.userId) {
    filter.userId = new mongoose.Types.ObjectId(String(filter.userId));
  }

  if (filter.store) {
    filter.store = new mongoose.Types.ObjectId(String(filter.store));
  }

  const aggregate = Order.aggregate([
    {
      $match: filter,
    },

    // ==========================
    // Store Details
    // ==========================
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
              logoUrl: 1,
              contactNo: 1,
              email: 1,
              address: 1,
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

    // ==========================
    // Product Details
    // ==========================
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
              unit: 1,
              image: 1,
            },
          },
        ],
      },
    },

    // ==========================
    // Created By Staff
    // ==========================
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'createdBy',
        pipeline: [
          {
            $project: {
              name: 1,
              email: 1,
              phone: 1,
              role: 1,
              profileImage: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: {
        path: '$createdBy',
        preserveNullAndEmptyArrays: true,
      },
    },

    // ==========================
    // Response
    // ==========================
    {
      $project: {
        orderNumber: 1,
        orderDate: 1,
        lorryNumber: 1,
        status: 1,
        remarks: 1,

        items: 1,
        productDetails: 1,

        store: 1,

        createdBy: 1,

        createdAt: 1,
        updatedAt: 1,
      },
    },

    {
      $sort: {
        [sortBy]: order === 'desc' ? -1 : 1,
      },
    },
  ]);

  return Order.aggregatePaginate(aggregate, {
    page: Number(page),
    limit: Number(limit),
    lean: true,
    leanWithId: false,
  });
};

export const getOrderById = async (id) => {
  const result = await Order.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(id),
      },
    },

    // ==========================
    // Customer Details
    // ==========================
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

    // ==========================
    // Product Details
    // ==========================
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
              unit: 1,
              image: 1,
              hsn: 1,
              sellingPrice: 1,
            },
          },
        ],
      },
    },

    // ==========================
    // Store Details
    // ==========================
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
              logoUrl: 1,
              contactNo: 1,
              email: 1,
              address: 1,
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

    // ==========================
    // Staff Details
    // ==========================
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'createdBy',
        pipeline: [
          {
            $project: {
              name: 1,
              email: 1,
              phone: 1,
              role: 1,
              profileImage: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: {
        path: '$createdBy',
        preserveNullAndEmptyArrays: true,
      },
    },

    // ==========================
    // Final Response
    // ==========================
    {
      $project: {
        orderNumber: 1,
        orderDate: 1,
        lorryNumber: 1,
        status: 1,
        remarks: 1,

        customer: 1,
        customerName: 1,
        customerMobile: 1,
        customerAddress: 1,
        customerGstNumber: 1,

        customerDetails: 1,

        items: 1,
        productDetails: 1,

        store: 1,

        createdBy: 1,

        createdAt: 1,
        updatedAt: 1,
      },
    },
  ]);

  return result[0] || null;
};

export const changeOrderStatus = async (orderId, data, approvedBy) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const order = await Order.findById(orderId).session(session);
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }
    if (order.status === 'delivered') {
      throw new ApiError(400, 'Delivered order cannot be modified');
    }
    const { status } = data;
    const statusFlow = {
      order_taken: ['approved'],
      approved: ['invoiced'],
      invoiced: ['delivered'],
      delivered: [],
    };
    if (!statusFlow[order.status].includes(status)) {
      throw new ApiError(400, `Cannot change status from "${order.status}" to "${status}"`);
    }
    order.status = status;
    order.approvedBy = approvedBy;
    switch (status) {
      case 'approved':
        order.approvedAt = new Date();
        break;

      case 'invoiced':
        order.invoicedAt = new Date();
        break;

      case 'delivered':
        order.deliveredBy = data.deliveredBy;
        order.challanNo = data.challanNo;
        order.challanDate = data.challanDate;
        order.lorryNumber = data.lorryNumber;
        order.deliveryAddress = data.deliveryAddress;

        // Auto
        order.actualDeliveryDate = new Date();

        break;
    }

    await order.save({ session });

    await session.commitTransaction();

    return order;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

export const createInvoiceFromOrder = async (orderId, body, store, userId) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const order = await Order.findOne({
      _id: orderId,
      store,
    }).session(session);

    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    if (order.isInvoiceCreated) {
      throw new ApiError(400, 'Invoice already created');
    }

    if (order.status !== 'approved') {
      throw new ApiError(400, 'Only approved orders can be converted into invoice');
    }

    const invoiceData = {
      ...body,

      store,
      userId,

      order: order._id,
    };

    const invoice = await createInvoice(invoiceData);

    order.invoice = invoice._id;
    order.isInvoiceCreated = true;
    order.status = 'invoiced';

    await order.save({ session });

    await session.commitTransaction();

    return invoice;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    await session.endSession();
  }
};
