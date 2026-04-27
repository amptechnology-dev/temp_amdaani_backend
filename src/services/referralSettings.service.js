import { ReferralSettings } from "../models/referralSettings.model.js";
import { ApiError } from "../utils/responseHandler.js";

export const createReferralSettings = async (data) => {

  const existingSettings = await ReferralSettings.findOne();

  if (existingSettings) {
    throw new ApiError(
      400,
      "Referral setting already present. Please update it instead of creating again."
    );
  }

  const settings = await ReferralSettings.create(data);

  return settings;
};


export const getReferralSettings = async () => {
  return ReferralSettings.findOne();
};

export const getReferralSettingsById = async (id) => {

  const settings = await ReferralSettings.findById(id);

  if (!settings) {
    throw new ApiError(404, "Referral settings not found");
  }

  return settings;
};


export const updateReferralSettings = async (data) => {

  const settings = await ReferralSettings.findOne();

  if (!settings) {
    throw new ApiError(
      404,
      "Referral setting not found. Please create it first."
    );
  }

  const updated = await ReferralSettings.findByIdAndUpdate(
    settings._id,
    data,
    { new: true }
  );

  return updated;
};