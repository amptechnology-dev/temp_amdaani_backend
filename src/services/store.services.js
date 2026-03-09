import { Store } from '../models/store.model.js';
import { ApiError } from '../utils/responseHandler.js';
import { compressAndUpload, deleteFileFromR2 } from '../services/image.service.js';
import config from '../config/config.js';
import { getCurrentSubscription } from './subscription.services.js';
import { getUsage } from './usage.service.js';

export const createStore = async (data, session = null) => {
  const store = new Store(data);
  await store.save(session ? { session } : undefined);
  return store;
};

export const getStoreById = async (id) => {
  return await Store.findById(id);
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

    // enforce write-once IDs
    if (store.gstNumber) delete data.gstNumber;
    if (store.panNumber) delete data.panNumber;
    if (store.registrationNo) delete data.registrationNo;

    if (data.address) {
      data.address = { ...store.address.toObject(), ...data.address };
    }
    if (data.bankDetails) {
      data.bankDetails = { ...store.bankDetails.toObject(), ...data.bankDetails };
    }
    if (data.settings) {
      data.settings = { ...store.settings.toObject(), ...data.settings };
    }

    // deep merge into document
    store.set(data);
    const updatedStore = await store.save({ session });

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
  const stores = await Store.find().sort({ name: 1 });

  const result = await Promise.all(
    stores.map(async (store) => {
      const subscription = await getCurrentSubscription(store._id);
      let usage = null;
      if (subscription) {
        usage = await getUsage(subscription._id);
      }
      return {
        ...store.toObject(),
        subscription: subscription || null,
        usage,
      };
    })
  );

  return result;
};
