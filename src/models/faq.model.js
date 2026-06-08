import mongoose from 'mongoose';

const faqSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    answer: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    isWeb: {
      type: Boolean,
      default: false,
    },
    isMobile: {
      type: Boolean,
      default: false,
    }
  },
  {
    timestamps: true,
  }
);

export const FAQ = mongoose.model('FAQ', faqSchema);
