import { createUser, checkUserExists, getUserByPhone } from './user.services.js';
import { createStore } from './store.services.js';
import {
  generateAuthTokens,
  generateRegistrationToken,
  generateSuperAdminToken,
  verifyToken,
} from './token.service.js';
import mongoose from 'mongoose';
import { ApiError } from '../utils/responseHandler.js';
import crypto from 'crypto';
import redis from '../config/redis.js';
import { Token } from '../models/token.model.js';
import tokenTypes from '../config/tokens.js';
import { getUserById } from './user.services.js';
import logger from '../config/logger.js';
import { compressAndUpload, deleteFileFromR2 } from '../services/image.service.js';
import config from '../config/config.js';
import axios from 'axios';
import { roles } from '../config/roles.js';
import { Role } from '../models/role.model.js';
import { User } from '../models/user.model.js';


export const sendOtp = async (phone) => {
  if (!phone) {
    throw new ApiError(400, 'Phone number is required', [
      { source: 'body', field: 'phone', message: 'Phone is required' },
    ]);
  }
  // const userExists = await User.exists({ phone });
  // if (!userExists) {
  //   throw new ApiError(404, 'User not found', [
  //     { source: 'body', field: 'phone', message: 'No account found with this phone number' },
  //   ]);
  // }
  if (phone === '9999999999') return true;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hash = crypto.createHash('sha256').update(otp).digest('hex');
  await redis.set(`otp:${phone}`, hash, 'EX', 60 * 5); // 5 min TTL
  const message = `${otp} is your OTP to login into AMDANI. Please do not share this OTP with anyone.- AMPTECH`;

  const params = {
    username: 'MTECHTRANS',
    apikey: '38892-B2424',
    apirequest: 'Text',
    sender: 'AMPTCH',
    mobile: phone,
    message,
    route: 'TRANS',
    TemplateID: '1407172715834228636',
    format: 'JSON',
  };

  const smsResponse = await axios.get(
    'http://text.mboxsolution.com/sms-panel/api/http/index.php',
    { params }
  );

  if (smsResponse.data.status !== 'success') {
    console.error('Failed to send SMS:', smsResponse.data);
    throw new ApiError(500, 'Failed to send SMS.', [
      { message: 'Failed to send SMS' },
    ]);
  }

  return true;
};


export const verifyOtp = async (phone, otp) => {
  const storedHash = await redis.get(`otp:${phone}`);
  if (!storedHash) {
    throw new ApiError(400, 'Invalid OTP!', [
      { source: 'body', field: 'otp', message: 'OTP not found or expired' },
    ]);
  }
  const incomingHash = crypto
    .createHash('sha256')
    .update(otp)
    .digest('hex');
  if (incomingHash !== storedHash) {
    throw new ApiError(400, 'Invalid OTP!', [
      { source: 'body', field: 'otp', message: 'Incorrect OTP' },
    ]);
  }
  await redis.del(`otp:${phone}`);
  const user = await getUserByPhone(phone);
  if (user) {
    const tokens = await generateAuthTokens(user);
    return { status: 'logged_in', user, tokens };
  }
  const tempToken = await generateRegistrationToken(phone);
  return { status: 'new_user', tempToken };
};

export const verifySuperAdminLogin = async (otp) => {
  const role = await Role.findOne({ name: roles.SUPERADMIN });
  if (!role) {
    throw new ApiError(400, 'Super Admin role not found');
  }
  const user = await User.findOne({ role: role._id });
  if (!user) {
    throw new ApiError(400, 'Super Admin user not found');
  }
  const phone = user.phone;
  const storedHash = await redis.get(`otp:${phone}`);
  if (!storedHash) {
    throw new ApiError(400, 'Invalid OTP!', [
      { source: 'body', field: 'otp', message: 'OTP not found or expired' },
    ]);
  }
  const incomingHash = crypto
    .createHash('sha256')
    .update(otp)
    .digest('hex');

  if (incomingHash !== storedHash) {
    throw new ApiError(400, 'Invalid OTP!', [
      { source: 'body', field: 'otp', message: 'Incorrect OTP' },
    ]);
  }
  await redis.del(`otp:${phone}`);
  const token = await generateSuperAdminToken(user._id);
  return { token };
};

export const registerUserWithStore = async (storeData, userData, files) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  // Keep track of uploaded files so we can clean them up if DB fails
  const uploadedKeys = [];
  try {
    // 1. Upload files to R2 first
    if (files?.logo) {
      const logoKey = await compressAndUpload(files.logo[0]?.buffer, { isPublic: true, height: 500, width: 500 });
      storeData.logoUrl = `${config.r2.publicEndpoint}/${logoKey}`;
      uploadedKeys.push(logoKey);
    }
    if (files?.signature) {
      const signatureKey = await compressAndUpload(files.signature[0]?.buffer, {
        isPublic: true,
        height: 200,
        width: 600,
      });
      storeData.signatureUrl = `${config.r2.publicEndpoint}/${signatureKey}`;
      uploadedKeys.push(signatureKey);
    }
    // 2. Check if user already exists
    if (await checkUserExists(userData.phone, session)) {
      throw new ApiError(400, 'User already exists', [
        { source: 'body', field: 'userData.phone', message: 'User already exists' },
      ]);
    }
    const ownerRole = await Role.findOne({ name: roles.OWNER }); //NOTE: Assign owner role to the user
    if (!ownerRole) {
      throw new ApiError(500, 'Owner role not found');
    }
    const store = await createStore(storeData, session);
    const user = await createUser({ ...userData, store: store._id, role: ownerRole._id }, session);

    await session.commitTransaction();
    session.endSession();
    return { user, store };
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();
    // 4. If DB failed after uploading files, delete them from R2
    for (const key of uploadedKeys) {
      try {
        await deleteFileFromR2(true, key);
      } catch (cleanupErr) {
        logger.error(cleanupErr, 'Error deleting file from R2.');
      }
    }
    throw error;
  }
};

/**
 * Logout
 * @param {string} refreshToken
 * @returns {Promise}
 */
export const logout = async (refreshToken) => {
  const refreshTokenDoc = await Token.findOne({
    token: refreshToken,
    type: tokenTypes.REFRESH,
    blacklisted: false,
  });
  if (!refreshTokenDoc) {
    throw new ApiError(404, 'Not found', [
      { source: 'body', field: 'refreshToken', message: 'Refresh token not found' },
    ]);
  }
  await Token.findByIdAndDelete(refreshTokenDoc._id);
};

/**
 * Refresh authentication tokens
 * @param {string} refreshToken - The refresh token
 * @returns {Promise<{ accessToken: string; refreshToken: string }>} - Object containing the new access and refresh tokens
 */
export const refreshAuth = async (refreshToken) => {
  try {
    const refreshTokenDoc = await verifyToken(refreshToken, tokenTypes.REFRESH);
    const user = await getUserById(refreshTokenDoc.user);
    if (!user) {
      throw new ApiError(401, 'Invalid token');
    }
    await refreshTokenDoc.deleteOne();
    return generateAuthTokens(user);
  } catch (error) {
    throw new ApiError(401, 'Token refresh failed! Please login again.', error);
  }
};
