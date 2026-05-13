import { UserSession } from '../models/userSession.model.js';

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
  accessToken
) => {
  return UserSession.findOne({
    accessToken,
    isActive: true,
  });
};

export const logoutOtherDevices = async (
  userId,
  currentAccessToken
) => {
  return UserSession.updateMany(
    {
      user: userId,
      accessToken: {
        $ne: currentAccessToken,
      },
      isActive: true,
    },
    {
      $set: {
        isActive: false,
      },
    }
  );
};