import mongoose from 'mongoose';

const usageSchema = new mongoose.Schema(
  {
    subscription: { type: mongoose.SchemaTypes.ObjectId, ref: 'Subscription', required: true, index: true },
    invoicesUsed: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Usage = mongoose.model('Usage', usageSchema);
