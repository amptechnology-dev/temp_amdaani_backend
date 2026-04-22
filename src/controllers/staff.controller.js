import * as staffService from "../services/staff.service.js";
import asyncHandler from "express-async-handler";
import { ApiResponse, ApiError } from "../utils/responseHandler.js";

export const createStaff = asyncHandler(async (req, res) => {
  const staff = await staffService.createStaff(req.body);

  return new ApiResponse(
    201,
    staff,
    "Staff created successfully"
  ).send(res);
});

export const getAllStaff = asyncHandler(async (req, res) => {
  const staff = await staffService.getAllStaff();

  return new ApiResponse(
    200,
    staff,
    "Staff list fetched successfully"
  ).send(res);
});

export const getStaffById = asyncHandler(async (req, res) => {
  const staff = await staffService.getStaffById(req.params.id);

  if (!staff) {
    throw new ApiError(404, "Staff not found");
  }

  return new ApiResponse(
    200,
    staff,
    "Staff fetched successfully"
  ).send(res);
});

export const updateStaff = asyncHandler(async (req, res) => {
  const staff = await staffService.updateStaff(req.params.id, req.body);

  if (!staff) {
    throw new ApiError(404, "Staff not found");
  }

  return new ApiResponse(
    200,
    staff,
    "Staff updated successfully"
  ).send(res);
});

export const deleteStaff = asyncHandler(async (req, res) => {
  const staff = await staffService.deleteStaff(req.params.id);

  if (!staff) {
    throw new ApiError(404, "Staff not found");
  }

  return new ApiResponse(
    200,
    null,
    "Staff deleted successfully"
  ).send(res);
});