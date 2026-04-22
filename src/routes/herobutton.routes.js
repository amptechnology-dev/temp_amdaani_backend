import express from "express";

import {
    createHeroButton,
    getAllHeroButtons,
    getHeroButtonById,
    updateHeroButton,
    deleteHeroButton,
    toggleHeroButtonStatus,
} from "../controllers/herobutton.controller.js";

import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/public-hero-button", getAllHeroButtons);

router.use(authenticate);

router.post(
    "/",
    authorizeRoles("super-admin"),
    createHeroButton
);

// get all
router.get("/", getAllHeroButtons);

// get single
router.get("/:id", getHeroButtonById);

// update
router.put(
    "/:id",
    authorizeRoles("super-admin"),
    updateHeroButton
);

// delete
router.delete("/:id", authorizeRoles("super-admin"), deleteHeroButton);

// toggle active / inactive
router.patch(
    "/toggle/:id",
    authorizeRoles("super-admin"),
    toggleHeroButtonStatus
);

export default router;