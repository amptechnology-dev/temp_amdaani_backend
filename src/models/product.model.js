import mongoose from 'mongoose';
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2';

const financialYearStockSchema =
  new mongoose.Schema(
    {
      financialYear: {
        type: String,
        required: true,
      },

      stock: {
        type: Number,
        default: 0,
        // min: 0,
      },
      value:{
        type: Number,
        default: 0,
      }
    },
    {
      _id: false,
    }
  );

const productSchema = new mongoose.Schema(
  {
    store: { type: mongoose.SchemaTypes.ObjectId, ref: 'Store', required: true },
    userId: { type: mongoose.SchemaTypes.ObjectId, ref: 'User' },
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
    isPurchaseTaxInclusive: { type: Boolean, default: false },
    discountPrice: Number,
    discountType: { type: String, enum: ['percentage', 'amount'] },
    discountPercentage: Number,
    purchaseDiscount: Number,
    purchaseDiscountType: { type: String, enum: ['percentage', 'amount'] },
    purchaseDiscountPercentage: Number,

    gstRate: Number,
    purchaseGstRate: Number,
    mrp: Number,
    weight: Number,
    currentStock: {
      type: Number,
      default: 0,
    },
    financialYearStocks:
      [
        financialYearStockSchema,
      ],
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
