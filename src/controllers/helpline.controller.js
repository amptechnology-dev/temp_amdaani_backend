import * as helplineService from "../services/helpline.service.js";
import asyncHandler from "express-async-handler";
import { ApiResponse, ApiError } from "../utils/responseHandler.js";

export const createHelpline = asyncHandler(async (req, res) => {

  const helpline = await helplineService.createHelpline(req.body);

  return new ApiResponse(
    201,
    helpline,
    "Helpline created successfully"
  ).send(res);

});

export const getHelpline = asyncHandler(async (req, res) => {

  const helpline = await helplineService.getPrimaryHelpline();

  return new ApiResponse(
    200,
    helpline,
    "Helpline fetched successfully"
  ).send(res);

});

export const getAllHelpline = asyncHandler(async (req, res) => {
  const helplines = await helplineService.getAllHelpline();
  return new ApiResponse(
    200,
    helplines,
    "Helplines fetched successfully"
  ).send(res);
});

export const getHelplineById = asyncHandler(async (req, res) => {

  const helpline = await helplineService.getHelplineById(req.params.id);

  if (!helpline) {
    throw new ApiError(404, "Helpline not found");
  }

  return new ApiResponse(
    200,
    helpline,
    "Helpline fetched successfully"
  ).send(res);

});

export const updateHelpline = asyncHandler(async (req, res) => {

  const helpline = await helplineService.updateHelpline(
    req.params.id,
    req.body
  );

  if (!helpline) {
    throw new ApiError(404, "Helpline not found");
  }

  return new ApiResponse(
    200,
    helpline,
    "Helpline updated successfully"
  ).send(res);

});

export const deleteHelpline = asyncHandler(async (req, res) => {

  const helpline = await helplineService.deleteHelpline(req.params.id);

  if (!helpline) {
    throw new ApiError(404, "Helpline not found");
  }

  return new ApiResponse(
    200,
    null,
    "Helpline deleted successfully"
  ).send(res);

});