import mongoose from 'mongoose';
import { Expense } from '../models/expense.model.js';
import {Purchase} from '../models/purchase.model.js';

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

export const getExpenseLedgerReport = async (
  filters = {}
) => {
  const {
    store,
    startDate,
    endDate,
  } = filters;

  const purchaseMatch = {
    store: new mongoose.Types.ObjectId(
      String(store)
    ),
    status: {
      $ne: "cancelled",
    },
  };

  const expenseMatch = {
    store: new mongoose.Types.ObjectId(
      String(store)
    ),
  };

  // date filter
  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    purchaseMatch.date = {
      $gte: start,
      $lte: end,
    };

    expenseMatch.date = {
      $gte: start,
      $lte: end,
    };
  }

  // ==========================
  // PURCHASE LEDGER
  // ==========================
  const purchaseData =
    await Purchase.aggregate([
      {
        $match: purchaseMatch,
      },

      {
        $lookup: {
          from: "vendors",
          localField: "vendor",
          foreignField: "_id",
          as: "vendor",
        },
      },

      {
        $unwind: {
          path: "$vendor",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $unwind: "$items",
      },

      {
        $addFields: {
          gstAmount: {
            $round: [
              {
                $multiply: [
                  {
                    $multiply: [
                      "$items.rate",
                      "$items.quantity",
                    ],
                  },
                  {
                    $divide: [
                      "$items.gstRate",
                      100,
                    ],
                  },
                ],
              },
              2,
            ],
          },

          itemAmount: {
            $multiply: [
              "$items.rate",
              "$items.quantity",
            ],
          },
        },
      },

      {
        $project: {
          _id: 1,
          date: "$date",

          type: {
            $literal: "purchase",
          },

          invoiceNumber:
            "$invoiceNumber",

          vendorName:
            "$vendor.name",

          productName:
            "$items.name",

          quantity:
            "$items.quantity",

          rate: "$items.rate",

          gstRate:
            "$items.gstRate",

          gstAmount: 1,

          discount:
            "$items.discount",

          amount:
            "$itemAmount",

          grandTotal:
            "$grandTotal",

          paymentMethod:
            "$paymentMethod",
        },
      },
    ]);

  // ==========================
  // OTHER EXPENSES
  // ==========================
  const otherExpenses =
    await Expense.aggregate([
      {
        $match: expenseMatch,
      },

      {
        $lookup: {
          from: "expenseheads",
          localField: "head",
          foreignField: "_id",
          as: "head",
        },
      },

      {
        $unwind: {
          path: "$head",
          preserveNullAndEmptyArrays:
            true,
        },
      },

      {
        $project: {
          _id: 1,
          date: 1,

          type: {
            $literal: "expense",
          },

          expenseHead:
            "$head.name",

          amount: 1,

          paymentMethod: 1,

          paidTo: 1,

          notes: 1,
        },
      },
    ]);

  // purchase only sort
  purchaseData.sort(
    (a, b) =>
      new Date(a.date) -
      new Date(b.date)
  );

  // other expense sort
  otherExpenses.sort(
    (a, b) =>
      new Date(a.date) -
      new Date(b.date)
  );

  // ==========================
  // SUMMARY
  // ==========================
  const summary = {
    totalPurchaseAmount:
      purchaseData.reduce(
        (sum, item) =>
          sum + (item.amount || 0),
        0
      ),

    totalPurchaseGST:
      purchaseData.reduce(
        (sum, item) =>
          sum +
          (item.gstAmount || 0),
        0
      ),

    totalPurchaseDiscount:
      purchaseData.reduce(
        (sum, item) =>
          sum +
          (item.discount || 0),
        0
      ),

    totalOtherExpense:
      otherExpenses.reduce(
        (sum, item) =>
          sum + (item.amount || 0),
        0
      ),
  };

  summary.grandTotalExpense =
    summary.totalPurchaseAmount +
    summary.totalPurchaseGST -
    summary.totalPurchaseDiscount +
    summary.totalOtherExpense;

  return {
    summary,

    // purchase data
    data: purchaseData,

    // expense table data
    otherExpenses,
  };
};
