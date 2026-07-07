import mongoose from 'mongoose';
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2';
import { ORDER_STATUS } from '../config/constants.js';

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    hsn: {
      type: String,
    },

    unit: {
      type: String,
    },

    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    gstRate: {
      type: Number,
      default: 0,
    },

    isTaxInclusive: {
      type: Boolean,
      default: false,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    discount: {
      type: Number,
      default: 0,
    },

    total: {
      type: Number,
      required: true,
    },
  },
  {
    _id: false,
  }
);

const orderSchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },

    customerName: String,
    customerMobile: String,
    customerAddress: String,
    customerGstNumber: String,

    orderNumber: {
      type: String,
      required: true,
    },

    orderDate: {
      type: Date,
      default: Date.now,
    },

    items: [orderItemSchema],

    deliveredBy: {
      type: String,
      trim: true,
    },

    deliveryDate:{
      type: Date,
    },
    actualDeliveryDate:{
      type: Date,
    },

    lorryNumber: {
      type: String,
      trim: true,
    },

    deliveryAddress: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: ORDER_STATUS,
      default: 'order_taken',
    },

    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
    },

    challanNo:{
      type: String,
      trim: true,
    },
    challanDate:{
      type: Date,
    },

    isInvoiceCreated: {
      type: Boolean,
      default: false,
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ store: 1, orderNumber: 1 }, { unique: true });
orderSchema.index({ store: 1, customer: 1 });
orderSchema.index({ store: 1, userId: 1 });
orderSchema.index({ store: 1, createdAt: -1 });

orderSchema.plugin(mongooseAggregatePaginate);

export const Order = mongoose.model('Order', orderSchema);
