import { Router } from 'express';
import * as adsController from '../controllers/ads.controller.js';
import validate from '../middlewares/validate.middleware.js';
import * as adsSchema from '../validations/ads.validation.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { uploadImage } from '../middlewares/multer.middleware.js';
import { authorizeRoles } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate);
router
  .route('/')
  .post(
    authorizeRoles('super-admin'),
    uploadImage.single('image'),
    validate(adsSchema.createAd),
    adsController.createAd
  )
  .get(adsController.getAds);
router
  .route('/id/:id')
  .get(adsController.getAdById)
  .put(
    uploadImage.single('image'),
    authorizeRoles('super-admin'),
    validate(adsSchema.updateAd),
    adsController.updateAd
  );

export default router;
