import passport from 'passport';

export const authenticate = passport.authenticate('jwt', { session: false });

export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!allowedRoles.includes(req.user.role?.name)) {
      return res.status(403).json({ message: 'Forbidden: Role not allowed' });
    }

    next();
  };
};
