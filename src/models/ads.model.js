import mongoose from 'mongoose';

const AdSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    imageUrl: { type: String, required: true },
    redirectUrl: { type: String, required: true },
    position: { type: String, enum: ['dashboard', 'invoice_footer', 'invoice_header'], required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    priority: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    // tracking
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

export const Ad = mongoose.model('Ad', AdSchema);
