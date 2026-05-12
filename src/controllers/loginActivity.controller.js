import asyncHandler from 'express-async-handler';
import { ApiResponse } from '../utils/responseHandler.js';
import { getLoginHistoryService } from '../services/loginActivity.service.js';

export const getLoginHistory =
    asyncHandler(async (
        req,
        res
    ) => {

        const activities =
            await getLoginHistoryService(
                req.user.id
            );

        return new ApiResponse(
            200,
            activities,
            'Login history fetched'
        ).send(res);
    });