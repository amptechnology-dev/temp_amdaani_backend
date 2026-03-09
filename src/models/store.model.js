import mongoose from 'mongoose';

const storeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true },
    tagline: String,
    ownershipType: String,
    gstNumber: { type: String, trim: true, uppercase: true },
    panNumber: { type: String, trim: true, uppercase: true },
    registrationNo: { type: String, trim: true },
    contactNo: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: {
      street: String,
      city: String,
      state: String,
      country: { type: String, default: 'IN' },
      postalCode: String,
    },
    bankDetails: {
      bankName: String,
      accountNo: String,
      holderName: String,
      ifsc: String,
      branch: String,
      upiId: String,
    },
    settings: {
      invoicePrefix: { type: String, default: 'INV' },
      invoiceStartNumber: { type: Number, default: 1 },
      taxRates: [{ name: String, rate: Number }],
      invoiceTerms: String,
    },
    currentSubscription: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Subscription',
    },
    logoUrl: String,
    signatureUrl: String,
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

export const Store = mongoose.model('Store', storeSchema);
