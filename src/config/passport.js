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
    if (/^[0-9a-fA-F]{24}$/.test(payload.sub)) {
      user = await User.findById(payload.sub).populate('role');
      console.log('User found by ID:', user);
    } else {
      user = await User.findOne({ phone: payload.sub }).populate('role');
      console.log('User found by phone:', user);
    }

    console.log('JWT Payload:', payload);

    if (!user) return done(null, false);

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