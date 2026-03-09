import expressAsyncHandler from 'express-async-handler';
import * as roleService from '../services/role.service.js';
import { ApiResponse, ApiError } from '../utils/responseHandler.js';

export const getRoles = expressAsyncHandler(async (req, res) => {
  const roles = await roleService.getRoles();
  return new ApiResponse(200, roles, 'Roles fetched successfully!').send(res);
});
