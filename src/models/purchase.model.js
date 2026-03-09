import mongoose from 'mongoose';
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2';

const purchaseItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  name: String,
  hsn: String,
  unit: String,
  batchNo: String,
  expiryDate: Date,
  rate: {
    type: Number,
    required: true,
  },
  gstRate: {
    type: Number,
    default: 0,
  },
  isTaxInclusive: {
    type: Boolean,
    default: false,
  },
  mrp: Number,
  quantity: {
    type: Number,
    required: true,
  },
  discount: {
    type: Number,
    default: 0,
  },
  total: {
    type: Number,
    required: true,
  },
  sellingPrice: Number,
  sellingDiscount: Number,
});

const purchaseSchema = new mongoose.Schema(
  {
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
    vendorName: String,
    vendorMobile: String,
    vendorAddress: String,
    vendorState: String,
    vendorGstNumber: String,
    vendorPanNumber: String,

    invoiceNumber: { type: String, required: true },
    date: { type: Date, default: Date.now },
    items: [purchaseItemSchema],
    // Totals
    subTotal: { type: Number, required: true },
    gstTotal: { type: Number, default: 0 },
    isIgst: { type: Boolean, default: false },
    discountTotal: { type: Number, default: 0 },
    roundOff: Number,
    grandTotal: { type: Number, required: true },
    // Metadata
    paymentStatus: { type: String, enum: ['paid', 'unpaid', 'partial'], default: 'unpaid' },
    amountPaid: { type: Number, default: 0 },
    amountDue: { type: Number, default: 0 },
    paymentMethod: String,
    paymentNote: String,
    status: { type: String, enum: ['active', 'cancelled'], default: 'active' },
    edited: { type: Boolean, default: false },
  },
  { timestamps: true }
);

purchaseSchema.index({ store: 1, invoiceNumber: 1, vendor: 1 });
purchaseSchema.index({ store: 1, createdAt: -1 });
purchaseSchema.plugin(mongooseAggregatePaginate);

export const Purchase = mongoose.model('Purchase', purchaseSchema);
