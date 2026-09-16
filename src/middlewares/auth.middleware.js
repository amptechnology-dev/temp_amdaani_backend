import passport from 'passport';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import config from '../config/config.js';
import { getActiveSession } from '../services/userSession.service.js';
import { UserStore } from '../models/UserStore.model.js';

export const authenticate = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, async (err, user) => {
    try {
      // JWT invalid
      if (err || !user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // Authorization header check
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ message: 'Token missing' });
      }

      const token = authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({ message: 'Invalid token format' });
      }

      // Session check
      const session = await getActiveSession(token);
      if (!session) {
        return res.status(401).json({ message: 'Session expired. Please login again.' });
      }

      // ── token payload থেকে store/role বের করো
      let decoded;
      try {
        decoded = jwt.verify(token, config.jwt.secret);
      } catch (decodeErr) {
        return res.status(401).json({ message: 'Invalid or expired token' });
      }

      // ── decoded.store/role validate করে ObjectId তে cast করো ──
      // JWT payload সবসময় plain string দেয় (JSON এ ObjectId বলে কিছু নেই),
      // তাই এখানেই cast করে রাখলে পুরো codebase এ (aggregate সহ) consistent থাকবে
      let storeObjectId = null;
      if (decoded.store) {
        if (!mongoose.isValidObjectId(decoded.store)) {
          return res.status(401).json({ message: 'Invalid store reference in token' });
        }
        storeObjectId = new mongoose.Types.ObjectId(decoded.store);
      }

      let roleObjectId = null;
      if (decoded.role) {
        if (!mongoose.isValidObjectId(decoded.role)) {
          return res.status(401).json({ message: 'Invalid role reference in token' });
        }
        roleObjectId = new mongoose.Types.ObjectId(decoded.role);
      }

      req.user = user;
      req.user.store = storeObjectId;
      req.user.role = roleObjectId ? { id: roleObjectId, name: decoded.roleName } : null;

      // Extra safety — token এ যে store আছে, সেটাতে user এর সত্যিই active membership আছে কিনা verify করো
      if (storeObjectId) {
        const membership = await UserStore.findOne({
          user: user._id,
          store: storeObjectId,
          isActive: true,
        });
        if (!membership) {
          return res.status(403).json({ message: 'Access to this store has been revoked' });
        }
      }

      next();
    } catch (error) {
      return res.status(500).json({
        message: 'Authentication failed',
        error: error.message,
      });
    }
  })(req, res, next);
};

export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role?.name)) {
      return res.status(403).json({ message: 'Forbidden: Role not allowed' });
    }

    next();
  };
};