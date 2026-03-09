import { Ad } from '../models/ads.model.js';
import { compressAndUpload, deleteFileFromR2 } from '../services/image.service.js';
import config from '../config/config.js';

export const createAd = async (data, file) => {
  let uploadedImage;
  try {
    if (file) {
      uploadedImage = await compressAndUpload(file.buffer, { isPublic: true });
      data.imageUrl = `${config.r2.publicEndpoint}/${uploadedImage}`;
    }
    const ad = await Ad.create(data);
    return ad;
  } catch (error) {
    if (uploadedImage) await deleteFileFromR2(true, uploadedImage);
    throw error;
  }
};

export const updateAdById = async (id, data, file) => {
  let uploadedImage;
  try {
    if (file) {
      uploadedImage = await compressAndUpload(file.buffer, { isPublic: true });
      data.imageUrl = `${config.r2.publicEndpoint}/${uploadedImage}`;
    }
    const ad = await Ad.findByIdAndUpdate(id, data, { new: true });
    return ad;
  } catch (error) {
    if (uploadedImage) await deleteFileFromR2(true, uploadedImage);
    throw error;
  }
};

export const getAdById = async (id) => {
  return Ad.findById(id);
};

export const getAds = async (filters = {}) => {
  return Ad.find(filters).sort({ priority: -1, createdAt: -1 });
};
