import expressAsyncHandler from "express-async-handler";
import * as heroService from "../services/hero.service.js";
import { ApiResponse, ApiError } from "../utils/responseHandler.js";
import pick from "../utils/pick.js";

export const createHeroSection = expressAsyncHandler(async (req, res) => {
    const hero = await heroService.createHeroSection(req.body, req.file);

    return new ApiResponse(201, hero, "Hero section created successfully!").send(res);
});

export const getHeroSections = expressAsyncHandler(async (req, res) => {
    const filters = pick(req.query, ["isActive"]);

    const heroes = await heroService.getHeroSections(filters);

    return new ApiResponse(200, heroes, "Hero sections fetched successfully!").send(res);
});

export const updateHeroSection = expressAsyncHandler(async (req, res) => {
    const hero = await heroService.updateHeroSectionById(
        req.params.id,
        req.body,
        req.file
    );

    if (!hero) {
        throw new ApiError(404, "Hero section not found!", [
            {
                source: "params",
                field: "id",
                message: "Hero section not found",
            },
        ]);
    }

    return new ApiResponse(200, hero, "Hero section updated successfully!").send(res);
});

export const getHeroSectionById = expressAsyncHandler(async (req, res) => {
    const hero = await heroService.getHeroSectionById(req.params.id);

    if (!hero) {
        throw new ApiError(404, "Hero section not found!", [
            {
                source: "params",
                field: "id",
                message: "Hero section not found",
            },
        ]);
    }

    return new ApiResponse(200, hero, "Hero section fetched successfully!").send(res);
});

export const deleteHeroSection = expressAsyncHandler(async (req, res) => {
    await heroService.deleteHeroSectionById(req.params.id);
    return new ApiResponse(200, null, "Hero section deleted successfully!").send(res);
});