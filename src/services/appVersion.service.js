import { AppVersion } from "../models/appVersion.model.js";
import config from "../config/config.js";
import { uploadApkToR2, deleteApkFromR2 } from "../services/apk.service.js";

export const uploadOrUpdateApk = async (data, file) => {
  let uploadedApk;

  try {

    if (file) {
      uploadedApk = await uploadApkToR2(file.buffer);

      data.apkKey = `${config.r2.publicEndpoint}/${uploadedApk}`;
    }

    let version = await AppVersion.findOne();

    if (version) {
      version = await AppVersion.findByIdAndUpdate(
        version._id,
        data,
        { new: true }
      );
    } else {
      version = await AppVersion.create(data);
    }

    return version;

  } catch (error) {

    if (uploadedApk) {
      await deleteApkFromR2(uploadedApk);
    }

    throw error;
  }
};


export const getApk = async () => {

  const version = await AppVersion.findOne();

  if (!version) {
    throw new ApiError(404, "APK not found");
  }

  return version;
};


export const deleteApk = async () => {

  const version = await AppVersion.findOne();

  if (!version) {
    throw new ApiError(404, "APK not found");
  }

  if (version.apkKey) {
    await deleteApkFromR2(version.apkKey);
  }

  await version.deleteOne();

  return true;
};