import expressAsyncHandler from 'express-async-handler';
import * as storeService from '../services/store.services.js';
import { ApiResponse, ApiError } from '../utils/responseHandler.js';
import { checkUserExists, createUser, getStoreUsers, deleteStoreUser } from '../services/user.services.js';
// import pick from "../utils/pick.js";

export const updateStore = expressAsyncHandler(async (req, res) => {
  const store = await storeService.updateStore(req.user.store, req.body, req.files);
  return new ApiResponse(200, store, 'Store updated successfully!').send(res);
});

export const getAllStoresWithSubscription = expressAsyncHandler(async (req, res) => {
  const stores = await storeService.getAllStoresWithSubscription();
  return new ApiResponse(200, stores, 'Stores fetched successfully!').send(res);
});

export const addNewStoreUser = expressAsyncHandler(async (req, res) => {
  if (await checkUserExists(req.body.phone)) {
    throw new ApiError(400, 'User already exists!', {
      source: 'body',
      field: 'phone',
      message: 'User with this mobile number already exists!',
    });
  }
  const storeUser = await createUser({ store: req.user.store, ...req.body });
  return new ApiResponse(200, storeUser, 'Store user created successfully!').send(res);
});

export const getAllStoreUsers = expressAsyncHandler(async (req, res) => {
  const storeUsers = await getStoreUsers(req.user.store);
  return new ApiResponse(200, storeUsers, 'Store users fetched successfully!').send(res);
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
