import mongoose from 'mongoose';
import tokenTypes from '../config/tokens.js';

const tokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      index: true,
    },
    user: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [tokenTypes.REFRESH],
      required: true,
    },
    expires: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
    blacklisted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export const Token = mongoose.model('Token', tokenSchema);
