import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    name: {
      type: String,
      trim: true,
      default: '',
    },

    phoneNumber: {
      type: String,
      trim: true,
      index: true,
      default: '',
    },

    status: {
      type: String,
      enum: ['active', 'closed'],
      default: 'active',
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const Conversation = mongoose.model('Conversation', conversationSchema);
