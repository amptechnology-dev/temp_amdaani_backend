import mongoose from "mongoose";

const referralSettingsSchema = new mongoose.Schema(
    {
        validityDays: {
            type: Number,
            required: true,
            min: 1,
        },
        senderAmount: {
            type: Number,
            required: true,
            min: 0,
        },
        receiverAmount: {
            type: Number,
            required: true,
            min: 0,
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

export const ReferralSettings = mongoose.model("ReferralSettings", referralSettingsSchema);