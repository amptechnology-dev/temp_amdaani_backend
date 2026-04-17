import expressAsyncHandler from "express-async-handler";
import * as appVersionService from "../services/appVersion.service.js";
import { ApiResponse } from "../utils/responseHandler.js";

export const uploadApk = expressAsyncHandler(async (req, res) => {

  const version = await appVersionService.uploadOrUpdateApk(
    req.body,
    req.file
  );

  return new ApiResponse(
    200,
    version,
    "APK uploaded successfully!"
  ).send(res);

});


export const getApk = expressAsyncHandler(async (req, res) => {

  const apk = await appVersionService.getApk();

  return new ApiResponse(
    200,
    apk,
    "APK fetched successfully!"
  ).send(res);

});


export const deleteApk = expressAsyncHandler(async (req, res) => {

  await appVersionService.deleteApk();

  return new ApiResponse(
    200,
    null,
    "APK deleted successfully!"
  ).send(res);

});