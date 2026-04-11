import { Router } from "express";
import * as faqController from "../controllers/faq.controller.js";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", faqController.getAllFaqs);
router.use(authenticate);
router.use(authorizeRoles("super-admin"));
router.post("/", faqController.createFaq);
router
  .route("/:id")
  .get(faqController.getFaqById)
  .put(faqController.updateFaq)
  .delete(faqController.deleteFaq);

export default router;