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
import { UserSession } from '../models/userSession.model.js';
import { generateAmdaaniId } from '../utils/generateAmdaaniId.js';
import { generateReferralCode } from '../utils/generateReferralCode.js';
import { validateReferralCode } from './referral.service.js';
import { Store } from '../models/store.model.js';
import { Referral } from '../models/referral.model.js';
import { saveLoginActivity } from './loginActivity.service.js';
import { createUserSession } from './userSession.service.js';
import { UserTracking } from '../models/UserTracking.model.js';
import { Staff } from '../models/staff.model.js';

export const sendOtp = async (phone) => {
  if (!phone) {
    throw new ApiError(400, 'Phone number is required', [
      {
        source: 'body',
        field: 'phone',
        message: 'Phone is required',
      },
    ]);
  }
  const user = await User.findOne({ phone });
  if (user && !user.isActive) {
    throw new ApiError(403, 'You are not an active user', [
      {
        source: 'body',
        field: 'user',
        message: 'Your account is not active. OTP cannot be sent.',
      },
    ]);
  }

  if (phone === '9999999999') {
    return true;
  }

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Hash OTP
  const hash = crypto.createHash('sha256').update(otp).digest('hex');

  // Store OTP in Redis (5 min expiry)
  await redis.set(`otp:${phone}`, hash, 'EX', 60 * 5);

  // SMS message
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

  // Send SMS
  const smsResponse = await axios.get('http://text.mboxsolution.com/sms-panel/api/http/index.php', { params });

  // SMS failed
  if (smsResponse.data.status !== 'success') {
    console.error('Failed to send SMS:', smsResponse.data);

    throw new ApiError(500, 'Failed to send SMS.', [
      {
        message: 'Failed to send SMS',
      },
    ]);
  }

  return true;
};

export const verifyOtp = async (phone, otp, req) => {
  // Get OTP hash from Redis
  const storedHash = await redis.get(`otp:${phone}`);

  if (!storedHash) {
    throw new ApiError(400, 'OTP expired or not found', [
      {
        source: 'body',
        field: 'otp',
        message: 'OTP not found or expired',
      },
    ]);
  }

  // Hash incoming OTP
  const incomingHash = crypto.createHash('sha256').update(String(otp)).digest('hex');

  // Compare OTP
  if (incomingHash !== storedHash) {
    throw new ApiError(400, 'Invalid OTP!', [
      {
        source: 'body',
        field: 'otp',
        message: 'Incorrect OTP',
      },
    ]);
  }

  /**
   * STEP 1:
   * OTP VERIFIED TRACKING
   */
  await UserTracking.findOneAndUpdate(
    {
      contactNo: phone,
    },
    {
      contactNo: phone,
      otpVerified: true,
      otpVerifiedAt: new Date(),
      currentStage: 'otp_verified',
    },
    {
      upsert: true,
      new: true,
    }
  );

  // Check user exists
  const user = await getUserByPhone(phone);

  // Existing user login
  if (user) {
    // Generate auth tokens
    const tokens = await generateAuthTokens(user);

    console.log('Generated Tokens:', tokens);

    // Save login activity
    const loginInfo = await saveLoginActivity(user._id, req);

    // Support multiple token structures
    const accessToken = tokens?.accessToken || tokens?.access?.token;

    const refreshToken = tokens?.refreshToken || tokens?.refresh?.token;

    // Validate token existence
    if (!accessToken || !refreshToken) {
      throw new ApiError(500, 'Token generation failed');
    }

    // Save session
    await createUserSession({
      userId: user._id,
      accessToken,
      refreshToken,

      device: loginInfo?.device || 'Unknown',

      browser: loginInfo?.browser || 'Unknown',

      os: loginInfo?.os || 'Unknown',

      ipAddress: loginInfo?.ipAddress || 'Unknown',
    });

    // Delete OTP only after success
    await redis.del(`otp:${phone}`);

    return {
      status: 'logged_in',
      user,
      tokens,
    };
  }

  // New user registration
  const tempToken = await generateRegistrationToken(phone);

  // Delete OTP after success
  await redis.del(`otp:${phone}`);

  return {
    status: 'new_user',
    tempToken,
  };
};

export const verifySuperAdminLogin = async (otp, req) => {
  const role = await Role.findOne({
    name: roles.SUPERADMIN,
  });

  if (!role) {
    throw new ApiError(400, 'Super Admin role not found');
  }

  const user = await User.findOne({
    role: role._id,
  });

  if (!user) {
    throw new ApiError(400, 'Super Admin user not found');
  }

  const phone = user.phone;

  // Get OTP from Redis
  const storedHash = await redis.get(`otp:${phone}`);

  if (!storedHash) {
    throw new ApiError(400, 'OTP expired or not found', [
      {
        source: 'body',
        field: 'otp',
        message: 'OTP not found or expired',
      },
    ]);
  }

  // Hash incoming OTP
  const incomingHash = crypto.createHash('sha256').update(String(otp)).digest('hex');

  // Compare OTP
  if (incomingHash !== storedHash) {
    throw new ApiError(400, 'Invalid OTP!', [
      {
        source: 'body',
        field: 'otp',
        message: 'Incorrect OTP',
      },
    ]);
  }

  // Generate token
  const token = await generateSuperAdminToken(user._id);

  console.log('SUPER ADMIN TOKEN:', token);

  // Save login activity
  const loginInfo = await saveLoginActivity(user._id, req);

  // Extract token properly
  const accessToken = typeof token === 'string' ? token : token?.accessToken;

  // Validate token
  if (!accessToken) {
    throw new ApiError(500, 'Token generation failed');
  }

  // Save session
  await createUserSession({
    userId: user._id,

    accessToken,

    // super admin refresh token নাই
    refreshToken: 'super-admin',

    device: loginInfo?.device || 'Unknown',

    browser: loginInfo?.browser || 'Unknown',

    os: loginInfo?.os || 'Unknown',

    ipAddress: loginInfo?.ipAddress || 'Unknown',
  });

  // Delete OTP after success
  await redis.del(`otp:${phone}`);

  return {
    token,
  };
};

export const registerUserWithStore = async (storeData, userData, files, req) => {
  const uploadedKeys = [];

  try {
    let referredBy = null;
    let referrerStore = null;

    if (storeData.usedReferralCode) {
      referrerStore = await Store.findOne({
        referralCode: storeData.usedReferralCode,
      });

      if (!referrerStore) {
        throw new ApiError(400, 'Invalid referral code', [
          {
            source: 'body',
            field: 'storeData.usedReferralCode',
            message: 'Invalid referral code',
          },
        ]);
      }

      referredBy = referrerStore._id;
    }

    const newReferralCode = await generateReferralCode(Store);

    storeData.referralCode = newReferralCode;

    storeData.referredBy = referredBy;

    if (files?.logo) {
      const logoKey = await compressAndUpload(files.logo[0]?.buffer, {
        isPublic: true,
        height: 500,
        width: 500,
      });

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

    if (await checkUserExists(userData.phone)) {
      throw new ApiError(400, 'User already exists', [
        {
          source: 'body',
          field: 'userData.phone',
          message: 'User already exists',
        },
      ]);
    }

    const ownerRole = await Role.findOne({
      name: roles.OWNER,
    });

    if (!ownerRole) {
      throw new ApiError(500, 'Owner role not found');
    }

    const store = await createStore(storeData);

    if (referrerStore) {
      await Referral.create({
        referrerStore: referrerStore._id,
        referredStore: store._id,
      });
    }

    const amdaaniId = await generateAmdaaniId();

    const user = await createUser({
      ...userData,
      amdaaniId,
      store: store._id,
      role: ownerRole._id,
    });

    await UserTracking.findOneAndUpdate(
      {
        contactNo: userData.phone,
      },
      {
        contactNo: userData.phone,

        userId: user._id,

        storeId: store._id,

        registered: true,

        registeredAt: new Date(),

        currentStage: 'registered',
      },
      {
        upsert: true,
        new: true,
      }
    );

    // Generate auth tokens
    const tokens = await generateAuthTokens(user);

    // Save login activity
    const loginInfo = await saveLoginActivity(user._id, req);

    // Support multiple token structures
    const accessToken = tokens?.accessToken || tokens?.access?.token;

    const refreshToken = tokens?.refreshToken || tokens?.refresh?.token;

    // Validate token existence
    if (!accessToken || !refreshToken) {
      throw new ApiError(500, 'Token generation failed');
    }

    // Save session
    await createUserSession({
      userId: user._id,

      accessToken,
      refreshToken,

      device: loginInfo?.device || 'Unknown',

      browser: loginInfo?.browser || 'Unknown',

      os: loginInfo?.os || 'Unknown',

      ipAddress: loginInfo?.ipAddress || 'Unknown',
    });

    return {
      user,
      store,
      tokens,
    };
  } catch (error) {
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
    console.log('refreshTokenDoc:', refreshTokenDoc);
    const user = await getUserById(refreshTokenDoc.user);
    if (!user) {
      throw new ApiError(401, 'Invalid token');
    }
    const tokens = await generateAuthTokens(user);

    await UserSession.findOneAndUpdate(
      {
        refreshToken,
        isActive: true,
      },
      {
        $set: {
          accessToken: tokens?.accessToken,

          refreshToken: tokens?.refreshToken,

          lastSeenAt: new Date(),
        },
      },
      {
        new: true,
      }
    );
    await refreshTokenDoc.deleteOne();
    return tokens;
  } catch (error) {
    console.error('Error refreshing auth:', error);
    throw new ApiError(401, 'Token refresh failed! Please login again.');
  }
};

export const assignAgentCodeToStore = async (storeId, agentCode) => {
  if (!agentCode) {
    throw new ApiError(400, 'Agent code is required');
  }

  // Find staff by agent code (optional)
  const staff = await Staff.findOne({
    agentCode: agentCode.trim(),
    isActive: true,
  });

  // Update store
  const updatedStore = await Store.findByIdAndUpdate(
    storeId,
    {
      $set: {
        agentCode: agentCode.trim(),
        registeredBy: staff ? staff._id : null,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!updatedStore) {
    throw new ApiError(404, 'Store not found');
  }

  return updatedStore;
};
