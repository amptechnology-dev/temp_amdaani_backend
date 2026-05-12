import mongoose from 'mongoose';

const LoginActivitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    ipAddress: String,

    device: String,

    browser: String,

    os: String,

    location: {
      city: String,
      country: String,
    },

    loginAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const LoginActivity = mongoose.model(
  'LoginActivity',
  LoginActivitySchema
);