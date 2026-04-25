import { Store } from "../models/store.model.js";

export const validateReferralCode = async (code) => {
  if (!code) return null;

  const referrerStore = await Store.findOne({ referralCode: code });

  if (!referrerStore) {
    throw new Error("Invalid referral code");
  }

  return referrerStore;
};