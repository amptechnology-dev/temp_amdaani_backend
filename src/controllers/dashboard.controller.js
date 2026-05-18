import expressAsyncHandler from 'express-async-handler';
import * as dashboardService from '../services/dashboard.service.js';
import { ApiResponse } from '../utils/responseHandler.js';

export const getUserTrackingDashboard =
    expressAsyncHandler(
        async (
            req,
            res
        ) => {

            const data =
                await dashboardService.getUserTrackingDashboard();

            return new ApiResponse(
                200,
                data,
                'Dashboard analytics fetched successfully!'
            ).send(res);
        }
    );