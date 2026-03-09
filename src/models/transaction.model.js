import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
    },
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'upi', 'bank-transfer', 'cheque'],
      default: 'cash',
    },
    note: String,
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded', 'cancelled'],
      default: 'completed',
    },
  },
  { timestamps: true }
);

transactionSchema.index({ store: 1, invoice: 1 });
transactionSchema.index({ store: 1, createdAt: -1 });

export const Transaction = mongoose.model('Transaction', transactionSchema);
