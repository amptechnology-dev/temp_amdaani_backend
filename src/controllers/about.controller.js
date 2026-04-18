import expressAsyncHandler from "express-async-handler";
import * as aboutService from "../services/about.service.js";
import { ApiResponse, ApiError } from "../utils/responseHandler.js";

export const createAbout = expressAsyncHandler(async (req, res) => {
  const about = await aboutService.createAbout(req.body);

  return new ApiResponse(201, about, "About section created").send(res);
});

export const getAbout = expressAsyncHandler(async (req, res) => {
  const about = await aboutService.getAbout();

  return new ApiResponse(200, about, "About section fetched").send(res);
});

export const getAboutById = expressAsyncHandler(async (req, res) => {
  const about = await aboutService.getAboutById(req.params.id);

  if (!about) {
    throw new ApiError(404, "About section not found");
  }

  return new ApiResponse(200, about, "About section fetched").send(res);
});

export const updateAbout = expressAsyncHandler(async (req, res) => {
  const about = await aboutService.updateAboutById(req.params.id, req.body);

  if (!about) {
    throw new ApiError(404, "About section not found");
  }

  return new ApiResponse(200, about, "About updated").send(res);
});