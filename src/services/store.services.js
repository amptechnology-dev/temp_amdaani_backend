import mongoose from 'mongoose';
import { Store } from '../models/store.model.js';
import { Product } from '../models/product.model.js';
import { ApiError } from '../utils/responseHandler.js';
import { compressAndUpload, deleteFileFromR2 } from '../services/image.service.js';
import config from '../config/config.js';
import { getCurrentSubscription } from './subscription.services.js';
import { getUsage } from './usage.service.js';
import { getCurrentFinancialYear } from '../utils/getCurrentFinancialYear.js';

export const createStore = async (data, session = null) => {
  const financialYear = getCurrentFinancialYear();
  const storeData = {
    ...data,
    registeredFinancialYear: data.registeredFinancialYear || financialYear,
    currentFinancialYear: data.currentFinancialYear || financialYear,
  };

  const store = new Store(storeData);

  await store.save(session ? { session } : undefined);

  return store;
};

export const getStoreById = async (id) => {
  return await Store.findById(id);
};

const flattenForSet = (prefix, obj, out = {}) => {
  for (const [key, value] of Object.entries(obj)) {
    const path = `${prefix}.${key}`;
    const isPlainObject = value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);

    if (isPlainObject) {
      flattenForSet(path, value, out);
    } else {
      out[path] = value;
    }
  }
  return out;
};

export const updateStore = async (storeId, data, files, session = null) => {
  let uploadedKeys = [];
  let oldLogoUrl, oldSignatureUrl;

  try {
    const store = await Store.findById(storeId, {}, { session });
    if (!store) {
      throw new ApiError(404, 'Store not found', [{ source: 'params', field: 'id', message: 'Invalid store id.' }]);
    }

    // file uploads
    if (files?.logo) {
      const logoKey = await compressAndUpload(files.logo[0]?.buffer, {
        isPublic: true,
        height: 500,
        width: 500,
      });
      data.logoUrl = `${config.r2.publicEndpoint}/${logoKey}`;
      uploadedKeys.push(logoKey);
      oldLogoUrl = store.logoUrl;
    }

    if (files?.signature) {
      const signatureKey = await compressAndUpload(files.signature[0]?.buffer, {
        isPublic: true,
        height: 200,
        width: 600,
      });
      data.signatureUrl = `${config.r2.publicEndpoint}/${signatureKey}`;
      uploadedKeys.push(signatureKey);
      oldSignatureUrl = store.signatureUrl;
    }

    // enforce write-once fields
    if (store.gstNumber) delete data.gstNumber;
    if (store.panNumber) delete data.panNumber;
    if (store.registrationNo) delete data.registrationNo;

    // Flatten only the top-level nested groups that were actually sent.
    // Anything the client didn't include is never touched.
    const NESTED_GROUPS = ['address', 'bankDetails', 'settings'];
    const setPayload = {};

    for (const key of Object.keys(data)) {
      if (NESTED_GROUPS.includes(key) && data[key] && typeof data[key] === 'object') {
        flattenForSet(key, data[key], setPayload);
      } else {
        setPayload[key] = data[key];
      }
    }

    const updatedStore = await Store.findByIdAndUpdate(
      storeId,
      { $set: setPayload },
      { new: true, runValidators: true, session }
    );

    // cleanup old files if replaced
    if (oldLogoUrl) {
      await deleteFileFromR2(true, oldLogoUrl.split(`${config.r2.publicEndpoint}/`)[1]);
    }
    if (oldSignatureUrl) {
      await deleteFileFromR2(true, oldSignatureUrl.split(`${config.r2.publicEndpoint}/`)[1]);
    }

    return updatedStore;
  } catch (error) {
    for (const key of uploadedKeys) {
      try {
        await deleteFileFromR2(true, key);
      } catch (cleanupErr) {
        logger.error(cleanupErr, 'Error deleting file from R2.');
      }
    }
    throw error;
  }
};

export const getAllStoresWithSubscription = async () => {
  const stores = await Store.aggregate([
    {
      $lookup: {
        from: 'staffs',
        localField: 'agentCode',
        foreignField: 'agentCode',
        as: 'staffInfo',
      },
    },
    {
      $unwind: {
        path: '$staffInfo',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: 'store',
        as: 'userInfo',
      },
    },
    {
      $addFields: {
        userId: {
          $ifNull: [
            {
              $arrayElemAt: ['$userInfo._id', 0],
            },
            null,
          ],
        },
      },
    },
    {
      $project: {
        userInfo: 0,
      },
    },
    {
      $sort: {
        name: 1,
      },
    },
  ]);

  const result = await Promise.all(
    stores.map(async (store) => {
      const subscription = await getCurrentSubscription(store._id);

      let usage = null;

      if (subscription) {
        usage = await getUsage(subscription._id);
      }

      return {
        ...store,
        staff: store.staffInfo || null,
        subscription: subscription || null,
        usage,
      };
    })
  );

  return result;
};

export const getStoreFinancialYears = async (storeId) => {
  const financialYears = await Product.aggregate([
    {
      $match: {
        store: new mongoose.Types.ObjectId(storeId),
      },
    },

    {
      $unwind: '$financialYearStocks',
    },

    {
      $group: {
        _id: '$financialYearStocks.financialYear',
      },
    },

    {
      $project: {
        _id: 0,
        financialYear: '$_id',
      },
    },

    {
      $sort: {
        financialYear: -1,
      },
    },
  ]);

  return financialYears;
};
