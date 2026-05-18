import { UserSession } from '../models/userSession.model.js';
import { LoginActivity } from "../models/LoginActivity.model.js";

export const createUserSession = async ({
  userId,
  accessToken,
  refreshToken,
  device,
  browser,
  os,
  ipAddress,
}) => {
  return UserSession.create({
    user: userId,

    accessToken,
    refreshToken,

    device,
    browser,
    os,
    ipAddress,

    isActive: true,
    lastSeenAt: new Date(),
  });
};

export const getActiveSession = async (
  token
) => {

  return UserSession.findOne({
    isActive: true,

    $or: [
      { accessToken: token },
      { refreshToken: token },
    ],
  });
};

export const logoutOtherDevices = async (userId, currentAccessToken) => {
    const sessionResult = await UserSession.updateMany(
    {
      user: userId,
      accessToken: { $ne: currentAccessToken },
      isActive: true,
    },
    {
      $set: { isActive: false },
    }
  );

    const loginActivityResult = await LoginActivity.deleteMany({
    user: userId,
  });

  return {
    sessionResult,
    loginActivityResult,
  };
};