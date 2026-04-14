import r2 from "../config/r2.js";
import { deleteFileFromR2 } from "./image.service.js";

/**
 * Upload APK file to R2
 * @param {Buffer} fileBuffer
 * @param {Object} options
 * @returns {Promise<string>}
 */

export const uploadApkToR2 = async (fileBuffer, options = {}) => {
  const {
    fileName = Bun.randomUUIDv7(),
    folder = "apk",
  } = options;

  const key = `${folder}/${fileName}.apk`;

  await r2.write(key, fileBuffer);

  return key;
};

export const deleteApkFromR2 = async (fileKey) => {
  await deleteFileFromR2(false, fileKey);
};