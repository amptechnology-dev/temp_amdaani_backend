import { Router } from "express";
import * as deviceController from "../controllers/device.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.post("/register", deviceController.registerDevice);

export default router;