import { User } from '../models/user.model.js';
import { Role } from '../models/role.model.js';
import { roles } from '../config/roles.js';
import { ApiResponse, ApiError } from '../utils/responseHandler.js';
import { generateAmdaaniId } from "../utils/generateAmdaaniId.js";

export const createSuperAdmin = async (data) => {

  const role = await Role.findOne({ name: roles.SUPERADMIN });

  if (!role) {
    throw new Error('Super Admin role not found. Please run role seeder first.');
  }

  const existingSuperAdmin = await User.findOne({ role: role._id });

  if (existingSuperAdmin) {
    throw new Error('Super Admin already exists');
  }

  const existingUser = await User.findOne({ phone: data.phone });

  if (existingUser) {
    throw new Error('User with this phone already exists');
  }

  const user = new User({
    ...data,
    role: role._id,
    isVerified: true,
  });

  await user.save();

  return user;
};

export const createStaff = async (ownerId, staffData) => {

  const owner = await User.findById(ownerId);

  if (!owner) {
    throw new ApiError(404, "Owner not found");
  }

  const storeId = owner.store;

  if (!storeId) {
    throw new ApiError(400, "Owner does not belong to any store");
  }

  const existingUser = await User.findOne({ phone: staffData.phone });

  if (existingUser) {
    throw new ApiError(400, "User already exists with this phone number");
  }

  const staffRole = await Role.findOne({ name: roles.STAFF });

  if (!staffRole) {
    throw new ApiError(500, "Staff role not found");
  }

  const amdaaniId = await generateAmdaaniId();

  const staff = await User.create({
    ...staffData,
    amdaaniId,
    store: storeId,
    role: staffRole._id,
    isVerified: true
  });

  return staff;
};

export const getStoreStaffs = async (ownerId) => {
  const owner = await User.findById(ownerId);
  if (!owner) {
    throw new ApiError(404, "Owner not found");
  }
  const storeId = owner.store;
  if (!storeId) {
    throw new ApiError(400, "Owner does not belong to any store");
  }
  const staffRole = await Role.findOne({ name: roles.STAFF });
  if (!staffRole) {
    throw new ApiError(500, "Staff role not found");
  }
  const staffs = await User.find({
    store: storeId,
    role: staffRole._id,
    isActive: true
  }).select("name phone email amdaaniId createdAt");
  return staffs;
};

export const createUser = async (data, session = null) => {
  const user = new User(data);
  await user.save(session ? { session } : undefined);
  await user.populate('store');
  return user;
};

export const checkUserExists = async (phone, session = null) => {
  return User.exists({ phone }, session ? { session } : undefined);
};

export const getUserById = async (id) => {
  return User.findById(id).populate('store').populate('role');
};

export const getUserByPhone = async (phone) => {
  return User.findOne({ phone }).populate('store').populate('role');
};

export const getStoreUsers = async (store) => {
  return User.find({ store }).populate('role', 'name');
};

export const deleteStoreUser = async (userId, storeId) => {
  return User.findOneAndDelete({ _id: userId, store: storeId });
};
