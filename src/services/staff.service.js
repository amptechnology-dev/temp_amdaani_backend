import mongoose from "mongoose";
import { Staff } from "../models/staff.model.js";
import { Store } from "../models/store.model.js";
import { ApiError } from "../utils/responseHandler.js";

export const createStaff = async (data) => {
  return Staff.create(data);
};

export const getAllStaff = async () => {
  return Staff.aggregate([
    {
      $lookup: {
        from: Store.collection.name, // "stores"
        localField: "_id",
        foreignField: "registeredBy",
        as: "registeredStores",
      },
    },
    {
      $addFields: {
        totalStoreRegistrations: {
          $size: "$registeredStores",
        },
      },
    },
    {
      $project: {
        registeredStores: 0, 
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
  ]);
};

export const getStaffById = async (id) => {
  return Staff.findById(id);
};

export const updateStaff = async (id, data) => {
  return Staff.findByIdAndUpdate(id, data, { new: true });
};

export const deleteStaff = async (id) => {
  return Staff.findByIdAndDelete(id);
};

export const getStoresByStaff = async (staffId) => {
  if (!mongoose.Types.ObjectId.isValid(staffId)) {
    throw new ApiError(400, "Invalid staff id");
  }

  const staff = await Staff.findById(staffId);

  if (!staff) {
    throw new ApiError(404, "Staff not found");
  }

  const stores = await Store.aggregate([
    {
      $match: {
        registeredBy: new mongoose.Types.ObjectId(staffId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "store",
        as: "user",
      },
    },
    {
      $addFields: {
        userId: {
          $ifNull: [
            {
              $arrayElemAt: ["$user._id", 0],
            },
            null,
          ],
        },
      },
    },
    {
      $project: {
        user: 0,
        __v: 0,
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
  ]);

  return {
    staff,
    totalStores: stores.length,
    stores,
  };
};