import mongoose from "mongoose";

const appVersionSchema = new mongoose.Schema(
  {
    version: {
      type: String,
      required: true,
    },

    apkKey: {
      type: String,
      required: true,
    },

    description: {
      type: String,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const AppVersion = mongoose.model('AppVersion', appVersionSchema);