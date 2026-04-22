import { Staff } from "../models/staff.model.js";

export const createStaff = async (data) => {
  return Staff.create(data);
};

export const getAllStaff = async () => {
  return Staff.find().sort({ createdAt: -1 });
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