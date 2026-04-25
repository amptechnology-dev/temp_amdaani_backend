import mongoose from "mongoose";

const walletTransactionSchema = new mongoose.Schema(
    {
        store: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Store",
            required: true,
        },

        amount: {
            type: Number,
            required: true,
        },

        type: {
            type: String,
            enum: ["credit", "debit"],
            required: true,
        },

        source: {
            type: String,
            enum: ["referral", "plan", "manual"],
            default: "referral",
        },

        referralId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Referral",
            default: null,
        },
        isExpiry:{
            type: Boolean,
            default: false,
        }
    },
    {
        timestamps: true,
    }
);

export const WalletTransaction = mongoose.model(
    "WalletTransaction",
    walletTransactionSchema
);