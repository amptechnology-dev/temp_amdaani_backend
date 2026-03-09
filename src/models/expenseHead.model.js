import mongoose from 'mongoose';

const ExpenseHeadSchema = new mongoose.Schema({
  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});

ExpenseHeadSchema.index({ store: 1, name: 1 }, { unique: true });

export const ExpenseHead = mongoose.model('ExpenseHead', ExpenseHeadSchema);
