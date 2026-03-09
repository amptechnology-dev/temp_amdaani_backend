import mongoose from 'mongoose';
import aggregatePaginate from 'mongoose-aggregate-paginate-v2';

const customerSchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
    },
    mobile: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
      default: 'IN',
    },
    postalCode: {
      type: String,
      trim: true,
    },
    gstNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

customerSchema.index({ store: 1, mobile: 1 }, { unique: true, sparse: true });
customerSchema.index({ store: 1, name: 1 });
customerSchema.plugin(aggregatePaginate);

export const Customer = mongoose.model('Customer', customerSchema);
