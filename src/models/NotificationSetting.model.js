import mongoose from "mongoose";

const NotificationSettingSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["subscription_expiry"],
  },

  daysBefore: {
    type: [Number], 
    default: [2, 0, -1] 
    // 2 = 2 days before
    // 0 = expiry day
    // -1 = 1 day after
  },

  enabled: {
    type: Boolean,
    default: true,
  }
});

export const NotificationSetting = mongoose.model(
  "NotificationSetting",
  NotificationSettingSchema
);