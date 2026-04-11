import mongoose from 'mongoose';

const FeedbackSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
    },
    store: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Store',
    },
    rating: Number,
    message: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    type: {
      type: String,
      enum: ['general', 'bug', 'feature', 'other'],
      default: 'general',
    },
    attachments: [
      {
        type: String,
        trim: true,
      },
    ],
    voiceUrl: {
      type: String,
    },
    status: {
      type: String,
      enum: ['open', 'in_review', 'resolved', 'rejected'],
      default: 'open',
    },
    adminResponse: String,
    metadata: {
      appVersion: String,
      deviceInfo: String,
      os: String,
    },
  },
  {
    timestamps: true,
  }
);

export const Feedback = mongoose.model('Feedback', FeedbackSchema);
