import mongoose from 'mongoose';

const vendorPaymentSchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
    },
    purchase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Purchase',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    paymentDate: { type: Date, default: Date.now },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'upi', 'bank-transfer', 'cheque'],
      default: 'cash',
    },
    referenceNumber: String,
    note: String,
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded', 'cancelled'],
      default: 'completed',
    },
  },
  { timestamps: true }
);

export const VendorPayment = mongoose.model('VendorPayment', vendorPaymentSchema);
