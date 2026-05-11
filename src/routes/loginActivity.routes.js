import { Router } from "express";
import * as controller from "../controllers/loginActivity.controller.js";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);


router.get('/login-history', controller.getLoginHistory);

export default router;