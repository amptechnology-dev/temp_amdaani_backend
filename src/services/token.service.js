import jwt from 'jsonwebtoken';
import config from '../config/config.js';
import { Token } from '../models/token.model.js';
import tokenTypes from '../config/tokens.js';
import ms from 'ms';

/**
 * Generate token
 * @param {string} userId - The ID of the user
 * @param {number|string} expiresIn - Token expiration time in seconds or string (e.g., 60, '2 days')
 * @param {string} type - Type of the token (e.g., 'access', 'refresh')
 * @param {string} [secret=config.jwt.secret] - Secret key for signing the token
 * @returns {string} - Signed JWT
 */
export const generateToken = (userId, expiresIn, type, secret = config.jwt.secret) => {
  return jwt.sign({ sub: userId, type }, secret, { expiresIn });
};

/**
 * Save a token
 * @param {string} token - The token to save
 * @param {ObjectId} user - The ID of the user
 * @param {Date} expires - Token expiration date-time
 * @param {string} type - Type of the token (e.g., 'access', 'refresh')
 * @param {boolean} [blacklisted] - Whether the token is blacklisted
 * @returns {Promise<Token>} - The saved token document
 */
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

/**
 * Verify token and return token doc (or throw an error if it is not valid)
 * @param {string} token - The token to verify
 * @param {string} type - Type of the token (e.g., 'access', 'refresh')
 * @returns {Promise<Token>} - The token document
 */
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
 * Generate auth tokens
 * @param {User} user - The user object
 * @returns {Promise<Object>} - Object containing the access and refresh tokens
 */
export const generateAuthTokens = async (user) => {
  const accessToken = generateToken(user._id, config.jwt.accessExpiration, tokenTypes.ACCESS);
  const refreshToken = generateToken(user._id, config.jwt.refreshExpiration, tokenTypes.REFRESH);
  await saveToken(refreshToken, user._id, new Date(Date.now() + ms(config.jwt.refreshExpiration)), tokenTypes.REFRESH);

  return {
    accessToken,
    refreshToken,
  };
};

/**
 * Generate temporary token for phone verification or registration
 * @param {string} phone - The phone number
 * @returns {Promise<string>} - The temporary token
 */
export const generateRegistrationToken = async (phone) => {
  const resetPasswordToken = generateToken(phone, config.jwt.registrationExpiration * 60 * 1000, tokenTypes.REGISTER);
  return resetPasswordToken;
};

export const verifyRegistrationToken = async (token) => {
  return jwt.verify(token, config.jwt.secret);
};

export const generateSuperAdminToken = async (userId) => {
  //NOTE:Hardcoded token expiry for now
  const superAdminToken = generateToken(userId, 24 * 60 * 60 * 1000, tokenTypes.ACCESS);
  return superAdminToken;
};

/**
 * Remove a token from DB (logout)
 */
export const revokeToken = async (token) => {
  return Token.findOneAndDelete({ token });
};
