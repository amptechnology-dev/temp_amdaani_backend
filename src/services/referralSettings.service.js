import { ReferralSettings } from "../models/referralSettings.model.js";

export const createReferralSettings = async (data) => {
  return ReferralSettings.create(data);
};

export const getReferralSettings = async () => {
  return ReferralSettings.findOne();
};

export const updateReferralSettings = async (data) => {
  return ReferralSettings.findOneAndUpdate({}, data, {
    new: true,
    upsert: true,
  });
};