import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    store: { type: mongoose.SchemaTypes.ObjectId, ref: 'Store', required: true },
    name: { type: String, required: true, trim: true },
    slug: String,
    gstRate: Number,
    isActive: { type: Boolean, default: true },
    images: [String],
  },
  { timestamps: true }
);

categorySchema.index({ store: 1, isActive: 1 });
categorySchema.index({ store: 1, name: 1 }, { unique: true });

export const Category = mongoose.model('Category', categorySchema);
