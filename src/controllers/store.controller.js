import expressAsyncHandler from 'express-async-handler';
import * as storeService from '../services/store.services.js';
import { ApiResponse, ApiError } from '../utils/responseHandler.js';
import {
  checkUserExists,
  createUser,
  getStoreUsers,
  deleteStoreUser,
  addUserToStore,
} from '../services/user.services.js';
import { roles } from '../config/roles.js';

export const updateStore = expressAsyncHandler(async (req, res) => {
  console.log('store-->', JSON.stringify(req.user.store));
  console.log('user body --> ', JSON.stringify(req.body));
  const store = await storeService.updateStore(req.user.store, req.body, req.files);
  return new ApiResponse(200, store, 'Store updated successfully!').send(res);
});

export const getAllStoresWithSubscription = expressAsyncHandler(async (req, res) => {
  const stores = await storeService.getAllStoresWithSubscription();
  return new ApiResponse(200, stores, 'Stores fetched successfully!').send(res);
});

export const addNewStoreUser = expressAsyncHandler(async (req, res) => {
  const { user, membership } = await addUserToStore(req.user.store, {
    name: req.body.name,
    phone: req.body.phone,
    email: req.body.email,
    roleId: req.body.role,
    roleName: !req.body.role ? roles.STAFF : undefined,
  });
  return new ApiResponse(
    200,
    { ...user.toObject(), membershipId: membership._id, role: membership.role },
    'Store user created successfully!'
  ).send(res);
});

export const getAllStoreUsers = expressAsyncHandler(async (req, res) => {
  const storeUsers = await getStoreUsers(req.user.store);
  return new ApiResponse(200, storeUsers, 'Store users fetched successfully!').send(res);
});

export const getSingleStoreById = expressAsyncHandler(async (req, res) => {
  const stores = await storeService.getStoreById(req.user.store);
  return new ApiResponse(200, stores, 'Store fetched successfully!').send(res);
});

export const deleteStoreUserById = expressAsyncHandler(async (req, res) => {
  const storeUser = await deleteStoreUser(req.params.id, req.user.store);
  if (!storeUser) {
    throw new ApiError(404, 'Store user not found!', {
      source: 'params',
      field: 'id',
      message: 'Store user not found!',
    });
  }
  return new ApiResponse(200, storeUser, 'Store user deleted successfully!').send(res);
});

export const getStoreFinancialYears = expressAsyncHandler(async (req, res) => {
  const data = await storeService.getStoreFinancialYears(req.user.store);

  return new ApiResponse(200, data, 'Financial years fetched successfully!').send(res);
});
