import redis from '../config/redis.js';
import { ApiError } from '../utils/responseHandler.js';
import { Role } from '../models/role.model.js';
import { User } from '../models/user.model.js';
import { roles } from '../config/roles.js';

export const authOtpLimiter = async (req, res, next) => {
  const phone = req.body.phone;

  if (!phone) {
    throw new ApiError(400, 'Phone number is required', [
      { source: 'body', field: 'phone', message: 'Phone is required' },
    ]);
  }

  const role = await Role.findOne({ name: roles.SUPERADMIN });

  if (role) {
    const superAdminUser = await User.findOne({ role: role._id });

    if (superAdminUser && superAdminUser.phone === phone) {
      return next();
    }
  }

  const hourlyKey = `otp:hourly:${phone}`;
  const dailyKey = `otp:daily:${phone}`;

  const hourlyCount = await redis.incr(hourlyKey);
  if (hourlyCount === 1) await redis.expire(hourlyKey, 60 * 60);

  const dailyCount = await redis.incr(dailyKey);
  if (dailyCount === 1) await redis.expire(dailyKey, 24 * 60 * 60);

  if (hourlyCount > 3) {
    throw new ApiError(429, 'Hourly OTP limit reached!', [
      { message: 'Too many OTP requests. Try again after 1 hour.' },
    ]);
  }

  if (dailyCount > 20) {
    throw new ApiError(429, 'Daily OTP limit reached!', [
      { message: 'Too many OTP requests. Please try again tomorrow.' },
    ]);
  }

  next();
};