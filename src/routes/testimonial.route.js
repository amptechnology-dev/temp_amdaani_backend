import express from "express";

import {
    createTestimonial,
    getAllTestimonials,
    getTestimonialById,
    updateTestimonial,
    deleteTestimonial,
} from "../controllers/testimonial.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/auth.middleware.js";
import {createTestimonialSchema, updateTestimonialSchema} from "../validations/testimonial.validation.js";
import validate from '../middlewares/validate.middleware.js';

const router = express.Router();

router.get("/public-testimonials", getAllTestimonials);

router.use(authenticate);

router.post("/", authorizeRoles("super-admin"),validate(createTestimonialSchema), createTestimonial);

router.get("/", getAllTestimonials);

router.get("/:id", getTestimonialById);

router.put("/:id", authorizeRoles("super-admin"), validate(updateTestimonialSchema), updateTestimonial);

router.delete("/:id", authorizeRoles("super-admin"), deleteTestimonial);

export default router;