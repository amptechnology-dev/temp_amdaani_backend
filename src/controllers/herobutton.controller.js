import expressAsyncHandler from "express-async-handler";
import * as heroButtonService from "../services/heroButton.service.js";
import { ApiResponse, ApiError } from "../utils/responseHandler.js";

// Create
export const createHeroButton = expressAsyncHandler(async (req, res) => {

    const heroButton = await heroButtonService.createHeroButton(req.body);

    return new ApiResponse(
        201,
        heroButton,
        "Hero button created successfully!"
    ).send(res);
});

// Get all
export const getAllHeroButtons = expressAsyncHandler(async (req, res) => {

    const buttons = await heroButtonService.getAllHeroButtons();

    return new ApiResponse(
        200,
        buttons,
        "Hero buttons fetched successfully!"
    ).send(res);
});

// Get by ID
export const getHeroButtonById = expressAsyncHandler(async (req, res) => {

    const button = await heroButtonService.getHeroButtonById(req.params.id);

    if (!button) {
        throw new ApiError(404, "Hero button not found");
    }

    return new ApiResponse(
        200,
        button,
        "Hero button fetched successfully!"
    ).send(res);
});

// Update
export const updateHeroButton = expressAsyncHandler(async (req, res) => {

    const button = await heroButtonService.updateHeroButton(
        req.params.id,
        req.body
    );

    if (!button) {
        throw new ApiError(404, "Hero button not found");
    }

    return new ApiResponse(
        200,
        button,
        "Hero button updated successfully!"
    ).send(res);
});

// Delete
export const deleteHeroButton = expressAsyncHandler(async (req, res) => {

    await heroButtonService.deleteHeroButton(req.params.id);

    return new ApiResponse(
        200,
        null,
        "Hero button deleted successfully!"
    ).send(res);
});

// Toggle Active / Inactive
export const toggleHeroButtonStatus = expressAsyncHandler(async (req, res) => {

    const button = await heroButtonService.toggleHeroButtonStatus(req.params.id);

    return new ApiResponse(
        200,
        button,
        "Hero button status updated!"
    ).send(res);
});

