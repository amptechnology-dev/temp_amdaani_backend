import { User } from '../models/user.model.js';
import { Role } from '../models/role.model.js';
import { roles } from '../config/roles.js';

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
