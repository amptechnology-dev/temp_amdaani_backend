import mongoose from 'mongoose';

const userSessionSchema = new mongoose.Schema(
    {
        user: {
            type:
                mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        accessToken: {
            type: String,
            required: true,
        },
        refreshToken: {
            type: String,
            required: true,
        },

        device: String,

        browser: String,

        os: String,

        ipAddress: String,

        isActive: {
            type: Boolean,
            default: true,
        },

        lastSeenAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

export const UserSession = mongoose.model('UserSession', userSessionSchema);