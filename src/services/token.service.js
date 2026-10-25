import jwt from 'jsonwebtoken';
import config from '../config/config.js';
import { Token } from '../models/token.model.js';
import tokenTypes from '../config/tokens.js';
import ms from 'ms';

/**
 * Generate token
 * @param {string} userId
 * @param {number|string} expiresIn
 * @param {string} type
 * @param {Object} [extraPayload={}] - store, role, roleName ইত্যাদি এখানে যাবে
 * @param {string} [secret=config.jwt.secret]
 */
export const generateToken = (userId, expiresIn, type, extraPayload = {}, secret = config.jwt.secret) => {
  return jwt.sign({ sub: userId, type, ...extraPayload }, secret, { expiresIn });
};

export const saveToken = async (token, user, expires, type, blacklisted = false) => {
  const tokenDoc = await Token.create({
    token,
    user,
    expires,
    type,
    blacklisted,
  });
  return tokenDoc;
};

export const verifyToken = async (token, type) => {
  const payload = jwt.verify(token, config.jwt.secret);
  const tokenDoc = await Token.findOne({
    user: payload.sub,
    token,
    type,
    blacklisted: false,
  });
  if (!tokenDoc) {
    throw new Error('Token not found');
  }
  return tokenDoc;
};

/**
 * Generate auth tokens — এখন store + role ও payload এ embed হবে
 * @param {User} user
 * @param {ObjectId} storeId
 * @param {ObjectId} roleId
 * @param {string} roleName - authorizeRoles middleware এ role.name দিয়ে check হয়, তাই এটা payload এ রাখা জরুরি
 */
export const generateAuthTokens = async (user, storeId = null, roleId = null, roleName = null) => {
  const payload = {
    ...(storeId && { store: storeId }),
    ...(roleId && { role: roleId }),
    ...(roleName && { roleName }),
  };

  const accessToken = generateToken(user._id, config.jwt.accessExpiration, tokenTypes.ACCESS, payload);
  const refreshToken = generateToken(user._id, config.jwt.refreshExpiration, tokenTypes.REFRESH, payload);

  await saveToken(refreshToken, user._id, new Date(Date.now() + ms(config.jwt.refreshExpiration)), tokenTypes.REFRESH);

  return {
    accessToken,
    refreshToken,
  };
};

export const generateRegistrationToken = async (phone) => {
  return generateToken(phone, `${config.jwt.registrationExpiration}m`, tokenTypes.REGISTER);
};

export const verifyRegistrationToken = async (token) => {
  return jwt.verify(token, config.jwt.secret);
};

export const generateSuperAdminToken = async (userId) => {
  return generateToken(userId, 24 * 60 * 60 * 1000, tokenTypes.ACCESS);
};

export const revokeToken = async (token) => {
  return Token.findOneAndDelete({ token });
};