import mongoose from "mongoose";

const userTrackingSchema = new mongoose.Schema(
    {
        contactNo: {
            type: String,
            required: true,
            unique: true,
        },

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        storeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Store",
            default: null,
        },

        otpVerified: {
            type: Boolean,
            default: false,
        },

        otpVerifiedAt: {
            type: Date,
            default: null,
        },

        registered: {
            type: Boolean,
            default: false,
        },

        registeredAt: {
            type: Date,
            default: null,
        },

        planPurchased: {
            type: Boolean,
            default: false,
        },

        planPurchasedAt: {
            type: Date,
            default: null,
        },

        currentStage: {
            type: String,
            enum: [
                "otp_verified",
                "registered",
                "plan_purchased",
            ],
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

export const UserTracking = mongoose.model("UserTracking", userTrackingSchema);
