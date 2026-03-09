import expressAsyncHandler from 'express-async-handler';
import { ApiResponse, ApiError } from '../utils/responseHandler.js';
import * as howToVideoService from '../services/howToVideo.service.js';

export const createHowToVideo = expressAsyncHandler(async (req, res) => {
  const video = await howToVideoService.createHowToVideo(req.body);
  return new ApiResponse(201, video, 'How-to video created successfully!').send(res);
});

export const getAllHowToVideos = expressAsyncHandler(async (req, res) => {
  const videos = await howToVideoService.getAllHowToVideos();
  return new ApiResponse(200, videos, 'All how-to videos fetched successfully!').send(res);
});

export const getHowToVideosByTag = expressAsyncHandler(async (req, res) => {
  const { tag } = req.params;
  const videos = await howToVideoService.getHowToVideosByTag(tag);
  return new ApiResponse(200, videos, 'How-to videos fetched successfully!').send(res);
});

export const getHowToVideoById = expressAsyncHandler(async (req, res) => {
  const video = await howToVideoService.getHowToVideoById(req.params.id);
  if (!video) {
    throw new ApiError(404, 'Video not found!', [{ source: 'params', path: 'id', message: 'Video not found!' }]);
  }
  return new ApiResponse(200, video, 'How-to video fetched successfully!').send(res);
});

export const updateHowToVideo = expressAsyncHandler(async (req, res) => {
  const video = await howToVideoService.updateHowToVideo(req.params.id, req.body);
  if (!video) {
    throw new ApiError(404, 'Video not found!', [{ source: 'params', path: 'id', message: 'Video not found!' }]);
  }
  return new ApiResponse(200, video, 'Video updated successfully!').send(res);
});

export const deleteHowToVideo = expressAsyncHandler(async (req, res) => {
  const video = await howToVideoService.deleteHowToVideo(req.params.id);
  if (!video) {
    throw new ApiError(404, 'Video not found!', [{ source: 'params', path: 'id', message: 'Video not found!' }]);
  }
  return new ApiResponse(200, null, 'Video deleted successfully!').send(res);
});

export const getActiveHowToVideos = expressAsyncHandler(async (req, res) => {
  const videos = await howToVideoService.getActiveHowToVideos();
  return new ApiResponse(200, videos, 'Active how-to videos fetched successfully!').send(res);
});
