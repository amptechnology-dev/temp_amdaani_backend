import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import passport from 'passport';
import config from './config.js';
import { User } from '../models/user.model.js';

// Optional: cookie থেকে token extract
const cookieExtractor = (req) => {
  if (req && req.signedCookies && req.signedCookies.accessToken) {
    return req.signedCookies.accessToken;
  }
  return null;
};

// JWT options
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromExtractors([
    ExtractJwt.fromAuthHeaderAsBearerToken(), // Bearer token
    cookieExtractor,
  ]),
  secretOrKey: config.jwt.secret,
};

// JWT verify function
const jwtVerify = async (payload, done) => {
  try {
    let user;

    // payload.sub হলো userId (ObjectId) অথবা phone (registration token এর ক্ষেত্রে)
    if (/^[0-9a-fA-F]{24}$/.test(payload.sub)) {
      user = await User.findById(payload.sub); // ⚠️ .populate('role') সরিয়ে দিলাম — User এ আর role field নাই
    } else {
      user = await User.findOne({ phone: payload.sub });
    }

    if (!user) return done(null, false);

    if (!user.isActive) return done(null, false);

    done(null, user);
  } catch (error) {
    done(error, false);
  }
};

// Export strategy
export const jwtStrategy = new JwtStrategy(jwtOptions, jwtVerify);

export default (app) => {
  app.use(passport.initialize());
  passport.use(jwtStrategy);
};
