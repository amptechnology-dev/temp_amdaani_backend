import { Router } from 'express';
import * as howToVideoController from '../controllers/howToVideo.controller.js';
import { createHowToVideoSchema, updateHowToVideoSchema } from '../validations/howToVideo.validation.js';
import validate from '../middlewares/validate.middleware.js';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate);
router.get('/active', howToVideoController.getActiveHowToVideos);
router.get('/tag/:tag', howToVideoController.getHowToVideosByTag);
router.get('/:id', howToVideoController.getHowToVideoById);

router.use(authorizeRoles('super-admin'));
router
  .route('/')
  .get(howToVideoController.getAllHowToVideos)
  .post(validate(createHowToVideoSchema), howToVideoController.createHowToVideo);
router
  .route('/:id')
  .put(validate(updateHowToVideoSchema), howToVideoController.updateHowToVideo)
  .delete(howToVideoController.deleteHowToVideo);

export default router;
