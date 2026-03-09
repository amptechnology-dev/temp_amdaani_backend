import mongoose from 'mongoose';

const batchSchema = new mongoose.Schema(
  {
    product: { type: mongoose.SchemaTypes.ObjectId, ref: 'Product', required: true },
    batchNumber: { type: String, required: true },
    expiryDate: Date,
    purchaseDate: Date,
    purchaseRate: Number,
    quantity: Number,
    sellingRate: Number,
    mrp: Number,
  },
  {
    timestamps: true,
  }
);

batchSchema.index({ product: 1, batchNumber: 1 }, { unique: true });

export const Batch = mongoose.model('Batch', batchSchema);
