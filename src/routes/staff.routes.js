import { Router } from "express";
import * as staffController from "../controllers/staff.controller.js";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);
router.use(authorizeRoles("super-admin"));

router.post("/", staffController.createStaff);
router.get("/", staffController.getAllStaff);

router
  .route("/:id")
  .get(staffController.getStaffById)
  .put(staffController.updateStaff)
  .delete(staffController.deleteStaff);

export default router;