import mongoose from 'mongoose';
import AggregatePaginate from 'mongoose-aggregate-paginate-v2';

const ExpenseSchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
    },
    date: { type: Date, required: true },
    head: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExpenseHead',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      required: true,
    },
    paidTo: String,
    notes: String,
    invoiceRef: String,
    enteredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

ExpenseSchema.index({ store: 1, date: -1 });
ExpenseSchema.plugin(AggregatePaginate);

export const Expense = mongoose.model('Expense', ExpenseSchema);
