import mongoose from 'mongoose';

const hsnCodeSchema = new mongoose.Schema(
  {
    store: { type: mongoose.SchemaTypes.ObjectId, ref: 'Store', required: true },
    code: { type: String, required: true, index: true },
    description: { type: String },
    gstRate: { type: Number, required: true },
  },
  { timestamps: true }
);

hsnCodeSchema.index({ store: 1, code: 1 }, { unique: true });

export const HsnCode = mongoose.model('HsnCode', hsnCodeSchema);
