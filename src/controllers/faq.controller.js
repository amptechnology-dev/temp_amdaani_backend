import * as faqService from "../services/faq.service.js";
import asyncHandler from "express-async-handler";
import { ApiResponse, ApiError } from "../utils/responseHandler.js";

export const createFaq = asyncHandler(async (req, res) => {
    const faq = await faqService.createFaq(req.body);
    return new ApiResponse(
        201,
        faq,
        "FAQ created successfully"
    ).send(res);

});


export const getAllFaqs = asyncHandler(async (req, res) => {
    const faqs = await faqService.getAllFaqs();
    return new ApiResponse(
        200,
        faqs,
        "FAQ list fetched successfully"
    ).send(res);

});


export const getFaqById = asyncHandler(async (req, res) => {
    const faq = await faqService.getFaqById(req.params.id);
    if (!faq) {
        throw new ApiError(404, "FAQ not found");
    }

    return new ApiResponse(
        200,
        faq,
        "FAQ fetched successfully"
    ).send(res);

});


export const updateFaq = asyncHandler(async (req, res) => {
    const faq = await faqService.updateFaq(req.params.id, req.body);
    if (!faq) {
        throw new ApiError(404, "FAQ not found");
    }
    return new ApiResponse(
        200,
        faq,
        "FAQ updated successfully"
    ).send(res);

});


export const deleteFaq = asyncHandler(async (req, res) => {
    const faq = await faqService.deleteFaq(req.params.id);
    if (!faq) {
        throw new ApiError(404, "FAQ not found");
    }
    return new ApiResponse(
        200,
        null,
        "FAQ deleted successfully"
    ).send(res);

});