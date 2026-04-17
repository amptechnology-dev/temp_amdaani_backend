import { Router } from "express";
import * as helplineController from "../controllers/helpline.controller.js";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", helplineController.getHelpline);

router.use(authenticate);
router.use(authorizeRoles("super-admin"));

router.post("/", helplineController.createHelpline);
router.get("/all-helpline", helplineController.getAllHelpline);

router
  .route("/:id")
  .get(helplineController.getHelplineById)
  .put(helplineController.updateHelpline)
  .delete(helplineController.deleteHelpline);

export default router;