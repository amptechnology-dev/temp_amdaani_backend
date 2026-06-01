import mongoose from 'mongoose';

const chatbotSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    keywords: [
      {
        type: String,
        trim: true,
      },
    ],

    answer: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    category: {
      type: String,
      default: 'general',
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

export const Chatbot = mongoose.model('Chatbot', chatbotSchema);
