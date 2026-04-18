import { Router } from "express";
import * as aboutController from "../controllers/about.controller.js";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/public-about", aboutController.getAbout);
router.use(authenticate);

router
  .route("/")
  .get(aboutController.getAbout)
  .post(authenticate, authorizeRoles("super-admin"), aboutController.createAbout);

router
  .route("/:id")
  .get(aboutController.getAboutById)
  .put(authenticate, authorizeRoles("super-admin"), aboutController.updateAbout);

export default router;