// import rateLimit from 'express-rate-limit';

// export const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 20,
//   skipSuccessfulRequests: true,
// });

import redis from '../config/redis.js';
import { ApiError } from '../utils/responseHandler.js';

export const authOtpLimiter = async (req, res, next) => {
  const phone = req.body.phone;
  if (phone === '8697972001') return next(); //NOTE: No rate for super admin
  if (phone === '9999999999') return next(); //NOTE: No rate for testing
  const hourlyKey = `otp:hourly:${phone}`; // 1-hour counter
  const dailyKey = `otp:daily:${phone}`; // 24h counter

  // Increment hourly counter
  const hourlyCount = await redis.incr(hourlyKey);
  if (hourlyCount === 1) await redis.expire(hourlyKey, 60 * 60); // 1 hour expiry
  // Increment daily counter
  const dailyCount = await redis.incr(dailyKey);
  if (dailyCount === 1) await redis.expire(dailyKey, 24 * 60 * 60); // 24h expiry

  // Hourly limit. 3 requests per hour
  if (hourlyCount > 3) {
    throw new ApiError(429, 'Hourly OTP limit reached!', [
      { message: 'Too many OTP requests. Try again after 1 hour.' },
    ]);
  }
  // Daily limit. 20 requests per day
  if (dailyCount > 20) {
    throw new ApiError(429, 'Daily OTP limit reached!', [
      { message: 'Too many OTP requests. Please try again tomorrow.' },
    ]);
  }
  next();
};
