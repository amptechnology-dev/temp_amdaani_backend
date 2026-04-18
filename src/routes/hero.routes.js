import { Router } from "express";
import * as heroController from "../controllers/hero.controller.js";
import validate from "../middlewares/validate.middleware.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { uploadImage } from "../middlewares/multer.middleware.js";
import { authorizeRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/list-hero-sections", heroController.getHeroSections);

router.use(authenticate);

router
    .route("/")
    .post(
        authorizeRoles("super-admin"),
        uploadImage.single("phoneImage"),
        heroController.createHeroSection
    )
    .get(heroController.getHeroSections);

router
    .route("/:id")
    .get(
        authorizeRoles("super-admin"),
        heroController.getHeroSectionById)
    .put(
        uploadImage.single("phoneImage"),
        authorizeRoles("super-admin"),
        heroController.updateHeroSection
    );

export default router;