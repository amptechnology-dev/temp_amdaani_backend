import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller.js';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(authenticate);
router.use(authorizeRoles("super-admin"));

router.get('/tracking-dashboard', dashboardController.getUserTrackingDashboard);

export default router;