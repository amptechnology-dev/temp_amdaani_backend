import { Router } from 'express';
import * as feedbackController from '../controllers/feedback.controller.js';
// import validate from '../middlewares/validate.middleware.js';
// import * as adsSchema from '../validations/ads.validation.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRoles } from '../middlewares/auth.middleware.js';
import { uploadAudio } from "../middlewares/multer.middleware.js";

const router = Router();

router.use(authenticate);
router.post('/', uploadAudio.single("voice"), feedbackController.createFeedback);

router.use(authorizeRoles('super-admin'));
router.route('/').get(feedbackController.getFeedbacks);
router
  .route('/:id')
  .get(feedbackController.getFeedbackById)
  .put(feedbackController.updateFeedbackStatus)
  .delete(feedbackController.deleteFeedback);

export default router;
