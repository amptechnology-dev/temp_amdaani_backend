import { Router } from "express";
import * as appVersionController from "../controllers/appVersion.controller.js";
import { uploadApk } from "../middlewares/multer.middleware.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.get(
    "/landing-apk",
    appVersionController.getApk
);

router.use(authenticate);

router.post(
    "/upload-apk",
    uploadApk.single("apk"),
    appVersionController.uploadApk
);

router.get(
    "/",
    appVersionController.getApk
);

router.delete(
    "/",
    appVersionController.deleteApk
);

export default router;