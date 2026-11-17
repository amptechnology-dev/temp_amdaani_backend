import mongoose from 'mongoose';

const PlanSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: String,
  price: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  durationDays: { type: Number, required: true, default: 0 },
  planType: {
    type: String,
    enum: ['regular', 'topup'],
    default: 'regular',
  },
  usageLimits: {
    invoices: Number,
    unlimited: { type: Boolean, default: false },
  },
  features: [
    {
      name: String,
      available: Boolean,
      note: String,
    },
  ],
  enabledFeatures: {
    manageStaff: { type: Boolean, default: false },
    stockManagement: { type: Boolean, default: false },
    orders: { type: Boolean, default: false },
    reports: { type: Boolean, default: false },
    purchaseManagement: { type: Boolean, default: false },
  },
  isActive: { type: Boolean, default: true },
});

export const Plan = mongoose.model('Plan', PlanSchema);
