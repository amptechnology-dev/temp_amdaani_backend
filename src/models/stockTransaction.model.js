import mongoose from 'mongoose';
import aggregatePaginate from 'mongoose-aggregate-paginate-v2';
import { StockTransactionType } from '../config/constants.js';

const stockTransactionSchema = new mongoose.Schema(
  {
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
    date: { type: Date, required: true },
    transactionType: {
      type: String,
      enum: Object.values(StockTransactionType),
      required: true,
    },
    quantity: { type: Number, required: true },
    direction: { type: String, enum: ['IN', 'OUT'], required: true },
    rate: Number,
    totalAmount: Number,
    remarks: String,
    saleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
    purchaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase' },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

stockTransactionSchema.index({ store: 1, product: 1, createdAt: -1 });
stockTransactionSchema.plugin(aggregatePaginate);

export const StockTransaction = mongoose.model('StockTransaction', stockTransactionSchema);
