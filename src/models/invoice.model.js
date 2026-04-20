import mongoose from 'mongoose';
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2';

const invoiceItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: { type: String, required: true },
  hsn: { type: String },
  unit: { type: String },
  sellingPrice: { type: Number, required: true },
  gstRate: { type: Number, default: 0 },
  isTaxInclusive: { type: Boolean, default: false },
  quantity: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  total: { type: Number, required: true },
});

const invoiceSchema = new mongoose.Schema(
  {
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customerName: { type: String },
    customerMobile: { type: String },
    customerAddress: { type: String },
    customerGstNumber: { type: String },
    // Invoice Details
    invoiceNumber: { type: String, required: true },
    invoiceDate: { type: Date, default: Date.now },
    type: { type: String, enum: ['gst', 'non-gst'], default: 'gst' },
    items: [invoiceItemSchema],
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
    remarks: String,
    status: { type: String, enum: ['active', 'cancelled'], default: 'active' },
    edited: { type: Boolean, default: false },
    name: { type: String,  trim: true },
        type: { type: String },
        tagline: String,
        ownershipType: String,
        gstNumber: { type: String, trim: true, uppercase: true },
        panNumber: { type: String, trim: true, uppercase: true },
        registrationNo: { type: String, trim: true },
        contactNo: { type: String, trim: true },
        email: { type: String, trim: true, lowercase: true },
        address: {
          street: String,
          city: String,
          state: String,
          country: { type: String, default: 'IN' },
          postalCode: String,
        },
        bankDetails: {
          bankName: String,
          accountNo: String,
          holderName: String,
          ifsc: String,
          branch: String,
          upiId: String,
        },
        settings: {
          invoicePrefix: { type: String, default: 'INV' },
          invoiceStartNumber: { type: Number, default: 1 },
          taxRates: [{ name: String, rate: Number }],
          invoiceTerms: String,
          stockManagement: { type: Boolean, default: false },
          purchaseOrderManagement: { type: Boolean, default: false },
        },
        logoUrl: String,
        signatureUrl: String,
        isActive: { type: Boolean, default: true },
      
  },
  { timestamps: true }
);

invoiceSchema.index({ store: 1, invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ store: 1, createdAt: -1 });
invoiceSchema.plugin(mongooseAggregatePaginate);

export const Invoice = mongoose.model('Invoice', invoiceSchema);
