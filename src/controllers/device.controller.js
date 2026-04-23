import expressAsyncHandler from "express-async-handler";
import * as deviceService from "../services/device.service.js";
import { ApiResponse } from "../utils/responseHandler.js";

export const registerDevice = expressAsyncHandler(async (req, res) => {

  const { fcmToken } = req.body;

  if (!fcmToken) {
    return new ApiResponse(400, null, "FCM token is required").send(res);
  }

  const device = await deviceService.registerDevice(
    req.user.store,
    fcmToken
  );

  return new ApiResponse(
    200,
    device,
    "Device registered successfully"
  ).send(res);

});