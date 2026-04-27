import { Router } from "express";
import * as referralSettingsController from "../controllers/referralSettings.controller.js";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);
router.use(authorizeRoles("super-admin"));

router.get("/", referralSettingsController.getReferralSettings);

router.get("/:id", referralSettingsController.getReferralSettingsById);

router.post("/", referralSettingsController.createReferralSettings);

router.put("/", referralSettingsController.updateReferralSettings);

export default router;