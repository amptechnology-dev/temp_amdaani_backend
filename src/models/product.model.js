import mongoose from 'mongoose';
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2';

const productSchema = new mongoose.Schema(
  {
    store: { type: mongoose.SchemaTypes.ObjectId, ref: 'Store', required: true },
    name: { type: String, required: true, trim: true },
    slug: String,
    category: { type: mongoose.SchemaTypes.ObjectId, ref: 'Category' },
    brand: String,
    sku: String,
    hsn: String,
    unit: String,
    costPrice: Number,
    lastPurchasePrice: Number,
    sellingPrice: Number,
    isTaxInclusive: { type: Boolean, default: false },
    discountPrice: Number,
    gstRate: Number,
    weight: Number,
    currentStock: {
      type: Number,
      default: 0,
    },
    tags: [String],
    status: { type: String, enum: ['active', 'inactive', 'cancelled'], default: 'active' },
  },
  { timestamps: true }
);

// productSchema.index({ store: 1, category: 1, status: 1 });
productSchema.index({ store: 1, status: 1 });
productSchema.index({ store: 1, name: 1 }, { unique: true });

productSchema.plugin(mongooseAggregatePaginate);

export const Product = mongoose.model('Product', productSchema);
