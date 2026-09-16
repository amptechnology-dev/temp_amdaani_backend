import mongoose from 'mongoose';
import { User } from '../models/user.model.js';
import { Store } from '../models/store.model.js';
import { Role } from '../models/role.model.js';
import { roles } from '../config/roles.js';
import { ApiResponse, ApiError } from '../utils/responseHandler.js';
import { generateAmdaaniId } from '../utils/generateAmdaaniId.js';
import { UserStore } from '../models/UserStore.model.js';

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
  // owner এর membership থেকে store বের করো (owner এর role owner হতে হবে)
  const ownerRole = await Role.findOne({ name: roles.OWNER });
  const ownerMembership = await UserStore.findOne({
    user: ownerId,
    role: ownerRole._id,
    isActive: true,
  });

  if (!ownerMembership) {
    throw new ApiError(400, 'Owner does not belong to any store');
  }

  const storeId = ownerMembership.store;

  const staffRole = await Role.findOne({ name: roles.STAFF });
  if (!staffRole) {
    throw new ApiError(500, 'Staff role not found');
  }

  let staffUser = await User.findOne({ phone: staffData.phone });

  if (!staffUser) {
    // নতুন staff, একদম নতুন system এ ঢুকছে
    const amdaaniId = await generateAmdaaniId();
    staffUser = await User.create({
      name: staffData.name,
      phone: staffData.phone,
      email: staffData.email,
      amdaaniId,
      isVerified: true,
    });
  } else {
    // existing user — এই store এ আগে থেকে membership আছে কিনা check করো
    const existingMembership = await UserStore.findOne({
      user: staffUser._id,
      store: storeId,
    });

    if (existingMembership) {
      throw new ApiError(400, 'This user is already a staff member of this store');
    }
  }

  const membership = await UserStore.create({
    user: staffUser._id,
    store: storeId,
    role: staffRole._id,
    isActive: true,
  });

  return { user: staffUser, membership };
};

export const getStoreStaffs = async (ownerId) => {
  const ownerRole = await Role.findOne({ name: roles.OWNER });
  const ownerMembership = await UserStore.findOne({
    user: ownerId,
    role: ownerRole._id,
    isActive: true,
  });

  if (!ownerMembership) {
    throw new ApiError(400, 'Owner does not belong to any store');
  }

  const staffRole = await Role.findOne({ name: roles.STAFF });
  if (!staffRole) {
    throw new ApiError(500, 'Staff role not found');
  }

  const memberships = await UserStore.find({
    store: ownerMembership.store,
    role: staffRole._id,
    isActive: true,
  }).populate('user', 'name phone email amdaaniId createdAt isActive');

  // flat staff list এ convert করলাম, যাতে frontend এ আগের মতোই response shape থাকে
  return memberships.map((m) => ({
    ...m.user.toObject(),
    membershipId: m._id,
    membershipIsActive: m.isActive,
  }));
};

export const getStaffById = async (ownerId, staffId) => {
  const ownerRole = await Role.findOne({ name: roles.OWNER });
  const ownerMembership = await UserStore.findOne({
    user: ownerId,
    role: ownerRole._id,
    isActive: true,
  });

  if (!ownerMembership) {
    throw new ApiError(400, 'Owner does not belong to any store');
  }

  const staffRole = await Role.findOne({ name: roles.STAFF });
  if (!staffRole) {
    throw new ApiError(500, 'Staff role not found');
  }

  const membership = await UserStore.findOne({
    user: staffId,
    store: ownerMembership.store,
    role: staffRole._id,
  }).populate('user', 'name phone email amdaaniId isActive createdAt');

  if (!membership) {
    throw new ApiError(404, 'Staff not found');
  }

  return {
    ...membership.user.toObject(),
    membershipId: membership._id,
    membershipIsActive: membership.isActive,
  };
};

export const updateStaff = async (ownerId, staffId, updateData) => {
  const ownerRole = await Role.findOne({ name: roles.OWNER });
  const ownerMembership = await UserStore.findOne({
    user: ownerId,
    role: ownerRole._id,
    isActive: true,
  });

  if (!ownerMembership) {
    throw new ApiError(400, 'Owner does not belong to any store');
  }

  const staffRole = await Role.findOne({ name: roles.STAFF });
  if (!staffRole) {
    throw new ApiError(500, 'Staff role not found');
  }

  const membership = await UserStore.findOne({
    user: staffId,
    store: ownerMembership.store,
    role: staffRole._id,
  });

  if (!membership) {
    throw new ApiError(404, 'Staff not found');
  }

  const staffUser = await User.findById(staffId);

  // phone change হলে uniqueness check (global, কারণ phone এখনো User level এ unique)
  if (updateData.phone && updateData.phone !== staffUser.phone) {
    const existingUser = await User.findOne({ phone: updateData.phone });
    if (existingUser) {
      throw new ApiError(400, 'Phone number already in use');
    }
  }

  // name/phone/email → User document এ আপডেট হবে (এগুলো global identity)
  if (updateData.name !== undefined) staffUser.name = updateData.name;
  if (updateData.phone !== undefined) staffUser.phone = updateData.phone;
  if (updateData.email !== undefined) staffUser.email = updateData.email;
  await staffUser.save();

  // isActive → এই নির্দিষ্ট store membership এ আপডেট হবে (অন্য store এ প্রভাব পড়বে না)
  if (updateData.isActive !== undefined) {
    membership.isActive = updateData.isActive;
    await membership.save();
  }

  return {
    ...staffUser.toObject(),
    membershipId: membership._id,
    membershipIsActive: membership.isActive,
  };
};

export const createUser = async (data, session = null) => {
  const amdaaniId = await generateAmdaaniId();
  const user = new User({ ...data, amdaaniId });
  await user.save(session ? { session } : undefined);
  return user;
};

export const checkUserExists = async (phone, session = null) => {
  return User.exists({ phone }, session ? { session } : undefined);
};

export const getUserById = async (id) => {
  return User.findById(id);
};

export const getUserByPhone = async (phone) => {
  return User.findOne({ phone });
};

export const getStoreUsers = async (storeId) => {
  const memberships = await UserStore.find({
    store: storeId,
    isActive: true,
  })
    .populate('user', 'name phone email amdaaniId isActive createdAt')
    .populate('role', 'name permissions');

  return memberships.map((m) => ({
    ...m.user.toObject(),
    role: m.role,
    membershipId: m._id,
    membershipIsActive: m.isActive,
  }));
};

export const getStoreByStoreId = async (store) => {
  return Store.findById(store);
};

export const deleteStoreUser = async (userId, storeId) => {
  const membership = await UserStore.findOneAndDelete({
    user: userId,
    store: storeId,
  });
  if (!membership) {
    return null;
  }
  const user = await User.findById(userId).select('name phone email amdaaniId');
  return { ...user?.toObject(), membershipId: membership._id };
};

export const getUserByEmail = async (email) => {
  return User.findOne({ email });
};

export const getOnlyUserByEmail = async (email) => {
  return User.findOne({ email });
};

export const updateUserPhone = async (userId, newPhone) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  user.phone = newPhone;
  await user.save();
  return user;
};
export const updateUserEmail = async (userId, email) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  user.email = email;
  await user.save();
  return user;
};

export const toggleStoreAndUsersStatus = async (storeId) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Find Store
    const store = await Store.findById(storeId).session(session);

    if (!store) {
      throw new ApiError(404, 'Store not found', [
        {
          source: 'params',
          field: 'storeId',
          message: 'Invalid store id',
        },
      ]);
    }

    // Toggle status
    const newStatus = !store.isActive;

    // Update Store
    await Store.findByIdAndUpdate(
      storeId,
      {
        isActive: newStatus,
      },
      {
        session,
      }
    );

    // Update all users
    await User.updateMany(
      {
        store: new mongoose.Types.ObjectId(String(storeId)),
      },
      {
        $set: {
          isActive: newStatus,
        },
      },
      {
        session,
      }
    );

    await session.commitTransaction();

    return {
      storeId,
      isActive: newStatus,
      message: newStatus ? 'Store and users activated successfully' : 'Store and users deactivated successfully',
    };
  } catch (error) {
    await session.abortTransaction();

    throw error;
  } finally {
    await session.endSession();
  }
};

export const getUserProfileWithMemberships = async (userId, currentStoreId = null) => {
  const user = await User.findById(userId);
  if (!user) return null;

  const memberships = await UserStore.find({ user: userId, isActive: true })
    .populate('store')
    .populate('role')
    .sort({ isDefault: -1, createdAt: 1 });

  const currentMembership =
    memberships.find((m) => m.store._id.toString() === currentStoreId?.toString()) ||
    memberships.find((m) => m.isDefault) ||
    memberships[0] ||
    null;

  const userObj = user.toObject();

  return {
    ...userObj,
    store: currentMembership?.store || null,
    role: currentMembership?.role || null,
    memberships: memberships.map((m) => ({
      membershipId: m._id,
      store: m.store,
      role: m.role,
      isDefault: m.isDefault,
    })),
  };
};

export const addUserToStore = async (storeId, { phone, name, email, roleName, roleId }) => {
  let targetRole;

  if (roleId) {
    // ObjectId দিয়ে সরাসরি role খোঁজা
    targetRole = await Role.findById(roleId);
  } else if (roleName) {
    // যদি roleName আসলে ObjectId হয়ে থাকে (frontend থেকে ভুলবশত), সেটাও handle করো
    if (mongoose.isValidObjectId(roleName)) {
      targetRole = await Role.findById(roleName);
    } else {
      targetRole = await Role.findOne({ name: roleName });
    }
  }

  if (!targetRole) {
    throw new ApiError(500, `Role '${roleName || roleId}' not found`);
  }

  let user = await User.findOne({ phone });

  if (!user) {
    const amdaaniId = await generateAmdaaniId();
    user = await User.create({ name, phone, email, amdaaniId, isVerified: true });
  }

  const existingMembership = await UserStore.findOne({ user: user._id, store: storeId });
  if (existingMembership) {
    throw new ApiError(400, 'This user is already associated with this store');
  }

  const membership = await UserStore.create({
    user: user._id,
    store: storeId,
    role: targetRole._id,
    isActive: true,
  });

  return { user, membership };
};

export const getMyStores = async (userId) => {
  const memberships = await UserStore.find({
    user: userId,
    isActive: true,
  })
    .populate('store', 'name logoUrl isActive type')
    .populate('role', 'name')
    .sort({ isDefault: -1, createdAt: 1 }); // default store আগে দেখাবে

  // যেসব store deactivate হয়ে গেছে, সেগুলো বাদ দিয়ে দিলাম
  const activeStores = memberships.filter((m) => m.store?.isActive);

  return activeStores.map((m) => ({
    storeId: m.store._id,
    name: m.store.name,
    logoUrl: m.store.logoUrl,
    type: m.store.type,
    role: m.role?.name,
    isDefault: m.isDefault,
    membershipId: m._id,
  }));
};
