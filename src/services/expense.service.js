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

  const storeId =
    new mongoose.Types.ObjectId(
      String(store)
    );

  const purchaseMatch = {
    store: storeId,
    status: {
      $ne: "cancelled",
    },
  };

  const expenseMatch = {
    store: storeId,
  };

  // ==========================
  // DATE FILTER
  // ==========================
  if (
    startDate &&
    endDate
  ) {
    const start =
      new Date(
        startDate
      );

    start.setHours(
      0,
      0,
      0,
      0
    );

    const end =
      new Date(endDate);

    end.setHours(
      23,
      59,
      59,
      999
    );

    purchaseMatch.date =
      {
        $gte: start,
        $lte: end,
      };

    expenseMatch.date =
      {
        $gte: start,
        $lte: end,
      };
  }

  // ==========================
  // PURCHASE EXPENSE REPORT
  // ==========================
  const purchaseData =
    await Purchase.aggregate([
      {
        $match:
          purchaseMatch,
      },

      {
        $lookup: {
          from:
            "vendors",
          localField:
            "vendor",
          foreignField:
            "_id",
          as: "vendor",
        },
      },

      {
        $unwind: {
          path:
            "$vendor",
          preserveNullAndEmptyArrays:
            true,
        },
      },

      {
        $addFields: {
          totalQuantity:
            {
              $sum:
                "$items.quantity",
            },

          taxableValue:
            {
              $sum: {
                $map: {
                  input:
                    "$items",
                  as: "item",
                  in: {
                    $multiply:
                      [
                        "$$item.quantity",
                        "$$item.rate",
                      ],
                  },
                },
              },
            },

          totalGST:
            {
              $sum: {
                $map: {
                  input:
                    "$items",
                  as: "item",
                  in: {
                    $multiply:
                      [
                        {
                          $multiply:
                            [
                              "$$item.quantity",
                              "$$item.rate",
                            ],
                        },
                        {
                          $divide:
                            [
                              "$$item.gstRate",
                              100,
                            ],
                        },
                      ],
                  },
                },
              },
            },
        },
      },

      {
        $project: {
          _id: 1,
          date: 1,

          invoiceNo:
            "$invoiceNumber",

          purchaseVendor:
            "$vendor.name",

          totalQuantity:
            1,

          rate: {
            $round: [
              {
                $cond: [
                  {
                    $gt: [
                      "$totalQuantity",
                      0,
                    ],
                  },
                  {
                    $divide:
                      [
                        "$taxableValue",
                        "$totalQuantity",
                      ],
                  },
                  0,
                ],
              },
              2,
            ],
          },

          taxableValue:
            {
              $round: [
                "$taxableValue",
                2,
              ],
            },

          cgst: {
            $round: [
              {
                $divide:
                  [
                    "$totalGST",
                    2,
                  ],
              },
              2,
            ],
          },

          sgst: {
            $round: [
              {
                $divide:
                  [
                    "$totalGST",
                    2,
                  ],
              },
              2,
            ],
          },

          totalExpense:
            {
              $round: [
                {
                  $add: [
                    "$taxableValue",
                    "$totalGST",
                  ],
                },
                2,
              ],
            },
        },
      },

      {
        $sort: {
          date: 1,
        },
      },
    ]);

  // ==========================
  // OTHER EXPENSES (GROUPED)
  // ==========================
  const otherExpenses =
    await Expense.aggregate([
      {
        $match:
          expenseMatch,
      },

      {
        $lookup: {
          from:
            "expenseheads",
          localField:
            "head",
          foreignField:
            "_id",
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

      // ✅ Group by expense head
      {
        $group: {
          _id:
            "$head.name",

          expenseHead:
            {
              $first:
                "$head.name",
            },

          totalAmount:
            {
              $sum:
                "$amount",
            },

          expenses:
            {
              $push: {
                _id:
                  "$_id",
                date:
                  "$date",
                amount:
                  "$amount",
                paymentMethod:
                  "$paymentMethod",
                paidTo:
                  "$paidTo",
                notes:
                  "$notes",
              },
            },
        },
      },

      {
        $project: {
          _id: 0,
          expenseHead:
            1,

          totalAmount:
            {
              $round: [
                "$totalAmount",
                2,
              ],
            },

          expenses: 1,
        },
      },

      {
        $sort: {
          expenseHead:
            1,
        },
      },
    ]);

  // ==========================
  // SUMMARY
  // ==========================
  const summary = {
    totalPurchaseExpense:
      purchaseData.reduce(
        (
          sum,
          item
        ) =>
          sum +
          (item.totalExpense ||
            0),
        0
      ),

    totalTaxableValue:
      purchaseData.reduce(
        (
          sum,
          item
        ) =>
          sum +
          (item.taxableValue ||
            0),
        0
      ),

    totalCGST:
      purchaseData.reduce(
        (
          sum,
          item
        ) =>
          sum +
          (item.cgst ||
            0),
        0
      ),

    totalSGST:
      purchaseData.reduce(
        (
          sum,
          item
        ) =>
          sum +
          (item.sgst ||
            0),
        0
      ),

    totalOtherExpense:
      otherExpenses.reduce(
        (
          sum,
          item
        ) =>
          sum +
          (item.totalAmount ||
            0),
        0
      ),
  };

  summary.grandTotalExpense =
    summary.totalPurchaseExpense +
    summary.totalOtherExpense;

  return {
    summary,

    // purchase expense
    data:
      purchaseData,

    // grouped other expenses
    otherExpenses,
  };
};
