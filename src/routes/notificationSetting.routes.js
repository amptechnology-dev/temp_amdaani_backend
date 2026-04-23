import { Router } from "express";
import * as controller from "../controllers/notificationSetting.controller.js";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);


router.post("/",authorizeRoles('super-admin'), controller.createSetting);

router.get("/", controller.getSettings);

router.get("/:id", controller.getSetting);

router.patch("/:id", controller.updateSetting);

router.delete("/:id", controller.deleteSetting);

export default router;