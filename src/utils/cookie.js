import config from '../config/config.js';

const isProd = config.env === 'production';
const cookieOptions = {
  signed: true,
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : 'lax',
  domain: isProd ? config.cookieDomain : undefined,
};

/**
 * Set authentication cookies on the response
 * @param {Object} res - The response object
 * @param {Object} tokens - The tokens object containing access and refresh tokens
 * @param {string} tokens.accessToken - The access token
 * @param {string} tokens.refreshToken - The refresh token
 * @returns {void}
 */
export const setAuthCookies = (res, tokens) => {
  res.cookie('accessToken', tokens.accessToken, {
    ...cookieOptions,
    maxAge: 24 * 60 * 60 * 1000, // 1 day
  });

  res.cookie('refreshToken', tokens.refreshToken, {
    ...cookieOptions,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
};

export const clearAuthCookies = (res) => {
  res.clearCookie('accessToken', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);
};
