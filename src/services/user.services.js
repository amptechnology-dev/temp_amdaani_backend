import { User } from '../models/user.model.js';

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
