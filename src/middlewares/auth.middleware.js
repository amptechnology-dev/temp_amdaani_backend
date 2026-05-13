import passport from 'passport';
import { getActiveSession } from '../services/userSession.service.js';

export const authenticate = (
  req,
  res,
  next
) => {

  passport.authenticate(
    'jwt',
    { session: false },

    async (
      err,
      user
    ) => {

      try {

        // JWT invalid
        if (err || !user) {
          return res.status(401).json({
            message: 'Unauthorized',
          });
        }

        // Authorization header check
        const authHeader =
          req.headers.authorization;

        if (!authHeader) {
          return res.status(401).json({
            message: 'Token missing',
          });
        }

        // Extract token
        const token =
          authHeader.split(' ')[1];

        if (!token) {
          return res.status(401).json({
            message:
              'Invalid token format',
          });
        }

        // Session check
        const session =
          await getActiveSession(
            token
          );

        if (!session) {
          return res.status(401).json({
            message:
              'Session expired. Please login again.',
          });
        }

        req.user = user;

        next();

      } catch (error) {

        return res.status(500).json({
          message:
            'Authentication failed',
          error:
            error.message,
        });
      }
    }
  )(req, res, next);
};

// Role based authorization
export const authorizeRoles =
  (...allowedRoles) => {

    return (
      req,
      res,
      next
    ) => {

      if (!req.user) {
        return res.status(401).json({
          message:
            'Unauthorized',
        });
      }

      if (
        allowedRoles.length > 0 &&
        !allowedRoles.includes(
          req.user.role?.name
        )
      ) {
        return res.status(403).json({
          message:
            'Forbidden: Role not allowed',
        });
      }

      next();
    };
  };