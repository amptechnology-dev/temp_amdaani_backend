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
import { createSuperAdmin, createStaff, getStoreStaffs, getUserById, getStaffById, updateStaff, getUserByEmail,updateUserPhone } from '../services/user.services.js';
import { createOrRenewFreePlan } from '../services/subscription.services.js';
import jwt from 'jsonwebtoken';
import transporter from '../config/emailtransporter.js';
import config from '../config/config.js';
import crypto from "crypto";
import redis from "../config/redis.js";

export const createSuperAdminUser = asyncHandler(async (req, res) => {
  const { phone, name, email } = req.body;

  if (!phone || !name) {
    throw new ApiError(400, 'Missing required fields', [
      { source: 'body', field: 'phone/name', message: 'Required fields missing' },
    ]);
  }

  try {
    const user = await createSuperAdmin({
      phone,
      name,
      email,
    });

    return new ApiResponse(201, user, 'Super Admin created successfully').send(res);
  } catch (error) {
    throw new ApiError(400, error.message || 'Failed to create Super Admin');
  }
});

export const registerStaff = asyncHandler(async (req, res) => {

  const ownerId = req.user.id;

  const { name, phone, email } = req.body;

  if (!name || !phone) {
    throw new ApiError(400, "Name and phone are required");
  }

  const staff = await createStaff(ownerId, {
    name,
    phone,
    email
  });

  return new ApiResponse(
    201,
    staff,
    "Staff registered successfully"
  ).send(res);

});

export const getStaffList = asyncHandler(async (req, res) => {

  const ownerId = req.user.id;

  const staffs = await getStoreStaffs(ownerId);

  return new ApiResponse(
    200,
    staffs,
    "Staff list fetched successfully"
  ).send(res);

});

export const getSingleStaff = asyncHandler(async (req, res) => {

  const ownerId = req.user.id;
  const { staffId } = req.params;

  const staff = await getStaffById(ownerId, staffId);

  return new ApiResponse(
    200,
    staff,
    "Staff details fetched successfully"
  ).send(res);

});


export const updateStaffDetails = asyncHandler(async (req, res) => {

  const ownerId = req.user.id;
  const { staffId } = req.params;

  const { name, phone, email, isActive } = req.body;

  const staff = await updateStaff(ownerId, staffId, {
    name,
    phone,
    email,
    isActive
  });

  return new ApiResponse(
    200,
    staff,
    "Staff updated successfully"
  ).send(res);

});

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

  console.log('RAW HEADER:', JSON.stringify(req.headers.authorization));
  console.log('TOKEN USED:', JSON.stringify(regToken));

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

export const sendPhoneRecoveryOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  const user = await getUserByEmail(email);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hash = crypto.createHash("sha256").update(otp).digest("hex");

  await redis.set(`emailOtp:${email}`, hash, "EX", 60 * 5);

  await transporter.sendMail({
    from: config.email.from,
    to: email,
    subject: "Phone Recovery OTP",
    html: `<h2>${otp}</h2><p>This OTP will expire in 5 minutes</p>`,
  });

  // recovery token
  const recoveryToken = jwt.sign(
    { userId: user._id, email },
    config.jwt.secret,
    { expiresIn: "10m" }
  );

  return new ApiResponse(
    200,
    { token: recoveryToken },
    "OTP sent to email"
  ).send(res);
});

export const verifyPhoneRecoveryOtp = asyncHandler(async (req, res) => {
  const { otp } = req.body;

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new ApiError(401, "Token missing");
  }

  const token = authHeader.split(" ")[1];

  const decoded = jwt.verify(token, config.jwt.secret);

  const { email, userId } = decoded;

  const storedHash = await redis.get(`emailOtp:${email}`);

  if (!storedHash) {
    throw new ApiError(400, "OTP expired");
  }

  const incomingHash = crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex");

  if (incomingHash !== storedHash) {
    throw new ApiError(400, "Invalid OTP");
  }

  await redis.del(`emailOtp:${email}`);

  // verified token
  const verifiedToken = jwt.sign(
    { userId, verified: true },
    config.jwt.secret,
    { expiresIn: "10m" }
  );

  return new ApiResponse(
    200,
    { token: verifiedToken },
    "OTP verified"
  ).send(res);
});

export const updatePhoneAfterOtp = asyncHandler(async (req, res) => {
  const { newPhone } = req.body;

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new ApiError(401, "Token missing");
  }

  const token = authHeader.split(" ")[1];

  const decoded = jwt.verify(token, config.jwt.secret);

  if (!decoded.verified) {
    throw new ApiError(403, "OTP verification required");
  }

  const updatedUser = await updateUserPhone(decoded.userId, newPhone);

  return new ApiResponse(
    200,
    { phone: updatedUser.phone },
    "Phone updated successfully"
  ).send(res);
});
