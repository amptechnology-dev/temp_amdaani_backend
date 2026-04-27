import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import validate from '../middlewares/validate.middleware.js';
import * as authSchema from '../validations/auth.validation.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { uploadImage } from '../middlewares/multer.middleware.js';
import { authOtpLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

router.post('/get-otp', authOtpLimiter, authController.sendAuthOtp);
router.post('/verify-otp', authController.verifyAuthOtp);
router.post(
  '/register',
  uploadImage.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'signature', maxCount: 1 },
  ]),
  validate(authSchema.register),
  authController.register
);
router.post('/logout', authenticate, authController.logoutAuth);
router.post('/refresh-tokens', validate(authSchema.refreshToken), authController.refreshTokens);
router.get('/me', authenticate, authController.getProfile);
router.post('/register-superadmin', authController.createSuperAdminUser);
router.post('/verify-otp-superadmin', authController.superAdminAuth);
router.post('/register-staff', authenticate, authController.registerStaff);
router.get('/store-staffs', authenticate, authController.getStaffList);
router.get('/store-staffs/:staffId', authenticate, authController.getSingleStaff);
router.put('/store-staffs/:staffId', authenticate, authController.updateStaffDetails);
// router.delete('/staff/:staffId', authenticate, authController.deleteStaff);
// router.post('/login', validate(authSchema.login), authController.login);
// router.post('/forgot-password', validate(authSchema.forgotPassword), authController.forgotPassword);
// router.post('/reset-password', validate(authSchema.resetPassword), authController.resetPassword);

export default router;
