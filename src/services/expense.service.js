import { Expense } from '../models/expense.model.js';

export const createExpense = async (expenseData) => {
  return Expense.create(expenseData);
};

export const queryExpenses = async (filters = {}, options = {}) => {
  const { page = 1, limit = 20, sortBy = 'date', order = 'desc' } = options;
  const sort = { [sortBy]: order === 'desc' ? -1 : 1 };

  // Build the match stage
  const matchStage = { store: filters.store };
  // Handle date range filtering
  if (filters.startDate || filters.endDate) {
    matchStage.date = {};
    if (filters.startDate) {
      matchStage.date.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      matchStage.date.$lte = new Date(filters.endDate);
    }
  }

  const paginationOptions = {
    page,
    limit,
    sort,
    lean: true,
    allowDiskUse: true,
  };

  const aggregate = Expense.aggregate([
    { $match: matchStage },
    {
      $lookup: {
        from: 'expenseheads',
        localField: 'head',
        foreignField: '_id',
        as: 'head',
        pipeline: [
          {
            $project: {
              _id: 1,
              name: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'enteredBy',
        foreignField: '_id',
        as: 'enteredBy',
        pipeline: [
          {
            $project: {
              _id: 1,
              name: 1,
            },
          },
        ],
      },
    },
  ]);

  return Expense.aggregatePaginate(aggregate, paginationOptions);
};

export const getExpenseById = async (expenseId) => {
  return Expense.findById(expenseId).populate('store', 'name').populate('head', 'name').populate('enteredBy', 'name');
};

export const updateExpense = async (expenseId, updateData) => {
  return Expense.findByIdAndUpdate(expenseId, updateData, { new: true });
};

export const deleteExpense = async (expenseId) => {
  return Expense.findByIdAndDelete(expenseId);
};

export const getExpensesGroupedByHead = async (storeId, { startDate, endDate }) => {

  const matchStage = { store: storeId };

  if (startDate || endDate) {
    matchStage.date = {};

    if (startDate) {
      matchStage.date.$gte = new Date(startDate);
    }

    if (endDate) {
      matchStage.date.$lte = new Date(endDate);
    }
  }

  return Expense.aggregate([
    { $match: matchStage },

    {
      $lookup: {
        from: "expenseheads",
        localField: "head",
        foreignField: "_id",
        as: "headInfo",
      },
    },

    { $unwind: "$headInfo" },

    { $sort: { date: -1 } },

    {
      $group: {
        _id: "$head",
        headName: { $first: "$headInfo.name" },

        totalAmount: { $sum: "$amount" },

        count: { $sum: 1 },

        expenses: {
          $push: {
            date: "$date",
            amount: "$amount",
            paymentMethod: "$paymentMethod",
            paidTo: "$paidTo",
            invoiceRef: "$invoiceRef",
            notes: "$notes",
          },
        },
      },
    },

    {
      $project: {
        _id: 0,
        headId: "$_id",
        headName: 1,
        totalAmount: 1,
        count: 1,
        expenses: 1,
      },
    },

    { $sort: { headName: 1 } },
  ]);
};
