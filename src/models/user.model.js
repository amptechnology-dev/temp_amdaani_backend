import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    store: { type: mongoose.SchemaTypes.ObjectId, ref: 'Store' },
    phone: { type: String, required: true, unique: true, trim: true },
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    isVerified: { type: Boolean, default: false },
    lastLoginAt: Date,
    role: { type: mongoose.SchemaTypes.ObjectId, ref: 'Role', required: true },
    preferences: {
      language: { type: String, default: 'en' },
      notifications: {
        paymentReminder: { type: Boolean, default: true },
      },
    },
    devices: [
      {
        deviceId: String,
        fcmToken: String,
        lastSeenAt: Date,
      },
    ],
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model('User', UserSchema);
