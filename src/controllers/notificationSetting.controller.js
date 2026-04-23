import expressAsyncHandler from "express-async-handler";
import * as settingService from "../services/notificationSetting.service.js";
import { ApiResponse } from "../utils/responseHandler.js";

export const createSetting = expressAsyncHandler(async (req, res) => {
    const setting = await settingService.createSetting(req.body);
    return new ApiResponse(
        201,
        setting,
        "Notification setting created"
    ).send(res);

});


export const getSettings = expressAsyncHandler(async (req, res) => {
    const settings = await settingService.getSettings();
    return new ApiResponse(
        200,
        settings,
        "Notification settings fetched"
    ).send(res);
});


export const getSetting = expressAsyncHandler(async (req, res) => {
    const setting = await settingService.getSettingById(req.params.id);
    return new ApiResponse(
        200,
        setting,
        "Notification setting fetched"
    ).send(res);
});


export const updateSetting = expressAsyncHandler(async (req, res) => {
    const setting = await settingService.updateSetting(
        req.params.id,
        req.body
    );
    return new ApiResponse(
        200,
        setting,
        "Notification setting updated"
    ).send(res);

});


export const deleteSetting = expressAsyncHandler(async (req, res) => {
    await settingService.deleteSetting(req.params.id);
    return new ApiResponse(
        200,
        null,
        "Notification setting deleted"
    ).send(res);

});