import asyncHandler from 'express-async-handler';
import { ApiResponse, ApiError } from '../utils/responseHandler.js';
import {
  sendOtp,
  verifyOtp,
  registerUserWithStore,
  logout,
  refreshAuth,
  verifySuperAdminLogin,
} from '../services/auth.service.js';
import { verifyRegistrationToken, generateAuthTokens } from '../services/token.service.js';
import { getUserById } from '../services/user.services.js';
import { createOrRenewFreePlan } from '../services/subscription.services.js';

export const sendAuthOtp = asyncHandler(async (req, res) => {
  const { phone } = req.body;
  await sendOtp(phone);
  return new ApiResponse(200, null, 'OTP sent successfully!').send(res);
});

export const verifyAuthOtp = asyncHandler(async (req, res) => {
  const { phone, otp } = req.body;
  try {
    const result = await verifyOtp(phone, otp);
    if (result.status === 'logged_in') {
      return new ApiResponse(200, { user: result.user, tokens: result.tokens }, 'Logged in successfully!').send(res);
    }
    return new ApiResponse(201, { tempToken: result.tempToken }, 'User not found! Registration started.').send(res);
  } catch (err) {
    throw new ApiError(400, 'Invalid OTP', [{ source: 'body', field: 'otp', message: 'Invalid OTP' }]);
  }
});

export const register = asyncHandler(async (req, res) => {
  const { storeData, userData } = req.body;
  const regToken = req.headers.authorization?.split(' ')[1];

  if (!regToken) {
    throw new ApiError(400, 'Invalid token', [{ source: 'headers', field: 'authorization', message: 'Invalid token' }]);
  }
  const phone = await verifyRegistrationToken(regToken);
  if (!phone || phone.sub !== userData?.phone) {
    throw new ApiError(400, 'Invalid token', [{ source: 'headers', field: 'authorization', message: 'Invalid token' }]);
  }
  const { user, store } = await registerUserWithStore(storeData, userData, req.files);
  const tokens = await generateAuthTokens(user);
  // await createOrRenewFreePlan(store._id);
  return new ApiResponse(201, { user, store, tokens }, 'Registered successfully!').send(res);
});

export const logoutAuth = asyncHandler(async (req, res) => {
  if (!req.body?.refreshToken) {
    return new ApiResponse(400, null, 'Refresh token is required').send(res);
  }
  await logout(req.body.refreshToken);
  // clearAuthCookies(res);
  return new ApiResponse(200, null, 'User logged out successfully.').send(res);
});

export const refreshTokens = asyncHandler(async (req, res) => {
  const refreshToken = req.body?.refreshToken;
  const tokens = await refreshAuth(refreshToken);
  // setAuthCookies(res, tokens);
  return new ApiResponse(200, tokens, 'Tokens refreshed successfully').send(res);
});

export const getProfile = asyncHandler(async (req, res) => {
  const user = await getUserById(req.user.id);
  return new ApiResponse(200, user, 'Profile fetched successfully').send(res);
});

export const superAdminAuth = asyncHandler(async (req, res) => {
  const token = await verifySuperAdminLogin(req.body.otp);
  return new ApiResponse(200, token, 'Super admin logged in successfully').send(res);
});
