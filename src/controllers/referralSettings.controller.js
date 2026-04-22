import * as referralSettingsService from "../services/referralSettings.service.js";
import asyncHandler from "express-async-handler";
import { ApiResponse, ApiError } from "../utils/responseHandler.js";

export const createReferralSettings = asyncHandler(async (req, res) => {
  const settings = await referralSettingsService.createReferralSettings(req.body);

  return new ApiResponse(
    201,
    settings,
    "Referral settings created successfully"
  ).send(res);
});


export const getReferralSettings = asyncHandler(async (req, res) => {
  const settings = await referralSettingsService.getReferralSettings();

  if (!settings) {
    throw new ApiError(404, "Referral settings not found");
  }

  return new ApiResponse(
    200,
    settings,
    "Referral settings fetched successfully"
  ).send(res);
});


export const updateReferralSettings = asyncHandler(async (req, res) => {
  const settings = await referralSettingsService.updateReferralSettings(req.body);

  return new ApiResponse(
    200,
    settings,
    "Referral settings updated successfully"
  ).send(res);
});