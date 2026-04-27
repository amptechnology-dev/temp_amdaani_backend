import mongoose from "mongoose";

const referralSchema = new mongoose.Schema(
  {
    referrerStore: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },

    referredStore: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },

    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      default: null,
    },

    senderReward: {
      type: Number,
      default: 0,
    },

    receiverReward: {
      type: Number,
      default: 0,
    },

    rewardStatus: {
      type: String,
      enum: ["pending", "completed", "expired"],
      default: "pending",
    },

    rewardAppliedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const Referral = mongoose.model("Referral", referralSchema);