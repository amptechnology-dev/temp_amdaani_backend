import mongoose from 'mongoose';

const SubscriptionSchema = new mongoose.Schema(
  {
    store: { type: mongoose.SchemaTypes.ObjectId, ref: 'Store', required: true, index: true },
    plan: { type: mongoose.SchemaTypes.ObjectId, ref: 'Plan', required: true },
    planName: String,
    price: { type: Number, required: true },
    durationDays: { type: Number, required: true },
    baseUsageLimits: {
      invoices: { type: Number, default: 0 },
      unlimited: { type: Boolean, default: false },
    },
    topUps: [
      {
        plan: {
          type: mongoose.SchemaTypes.ObjectId,
          ref: 'Plan',
          required: true,
        },
        appliedAt: { type: Date, default: Date.now },
        expiresAt: Date,
        usageLimits: {
          invoices: { type: Number, default: 0 },
        },
      },
    ],
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['active', 'expired', 'canceled', 'upcoming'],
      index: true,
    },
  },
  {
    timestamps: true,
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
  }
);
SubscriptionSchema.index({ status: 1, endDate: 1 });

// Ensure endDate is set to end of day
SubscriptionSchema.pre('save', function (next) {
  if (this.isModified('endDate') && this.endDate) {
    // Set time to end of day (23:59:59.999)
    this.endDate = new Date(this.endDate);
    this.endDate.setHours(23, 59, 59, 999);
  }
  next();
});

// Virtual for total usage limits (base + all active top-ups)
SubscriptionSchema.virtual('usageLimits').get(function () {
  const total = this.baseUsageLimits;
  this.topUps.forEach((topUp) => {
    // if (topUp.expiresAt > Date.now()) {
    total.invoices += topUp.usageLimits.invoices;
    // }
  });
  return total;
});

const PaymentSchema = new mongoose.Schema(
  {
    store: { type: mongoose.SchemaTypes.ObjectId, ref: 'Store', required: true, index: true, sparse: true },
    subscription: { type: mongoose.SchemaTypes.ObjectId, ref: 'Subscription' },
    amount: { type: Number, required: true },
    currency: String,
    method: String,
    transactionId: String,
    status: { type: String, enum: ['success', 'pending', 'failed'], default: 'pending' },
    walletUsed: { type: Number, default: 0 },
    paidAt: Date,
    notes: String,
  },
  { timestamps: true }
);

export const Payment = mongoose.model('Payment', PaymentSchema);
export const Subscription = mongoose.model('Subscription', SubscriptionSchema);
