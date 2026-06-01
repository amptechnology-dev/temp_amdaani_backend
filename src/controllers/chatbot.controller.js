import asyncHandler from 'express-async-handler';

import * as chatbotService from '../services/chatbot.service.js';

import { ApiResponse, ApiError } from '../utils/responseHandler.js';

export const chat = asyncHandler(async (req, res) => {
  const { message } = req.body;

  if (!message) {
    throw new ApiError(400, 'Message is required');
  }

  const result = await chatbotService.getChatReply(message);

  return new ApiResponse(200, result, 'Reply generated successfully').send(res);
});

export const createChatbot = asyncHandler(async (req, res) => {
  const chatbot = await chatbotService.createChatbot(req.body);

  return new ApiResponse(201, chatbot, 'Chatbot FAQ created successfully').send(res);
});

export const getAllChatbots = asyncHandler(async (req, res) => {
  const chatbots = await chatbotService.getAllChatbots();

  return new ApiResponse(200, chatbots, 'Chatbot list fetched successfully').send(res);
});

export const getChatbotById = asyncHandler(async (req, res) => {
  const chatbot = await chatbotService.getChatbotById(req.params.id);

  if (!chatbot) {
    throw new ApiError(404, 'Chatbot FAQ not found');
  }

  return new ApiResponse(200, chatbot, 'Chatbot fetched successfully').send(res);
});

export const updateChatbot = asyncHandler(async (req, res) => {
  const chatbot = await chatbotService.updateChatbot(req.params.id, req.body);

  if (!chatbot) {
    throw new ApiError(404, 'Chatbot FAQ not found');
  }

  return new ApiResponse(200, chatbot, 'Chatbot updated successfully').send(res);
});

export const deleteChatbot = asyncHandler(async (req, res) => {
  const chatbot = await chatbotService.deleteChatbot(req.params.id);

  if (!chatbot) {
    throw new ApiError(404, 'Chatbot FAQ not found');
  }

  return new ApiResponse(200, null, 'Chatbot deleted successfully').send(res);
});
