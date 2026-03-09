import { Router } from 'express';
import * as storeController from '../controllers/store.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import * as storeSchema from '../validations/store.validation.js';
import { uploadImage } from '../middlewares/multer.middleware.js';
import { authorizeRoles } from '../middlewares/auth.middleware.js';
import { roles } from '../config/roles.js';

const router = Router();

router.use(authenticate);
router.route('/update-my-store').put(
  uploadImage.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'signature', maxCount: 1 },
  ]),
  validate(storeSchema.updateStore),
  storeController.updateStore
);
router
  .route('/users')
  .post(authorizeRoles(roles.OWNER), validate(storeSchema.createStoreUser), storeController.addNewStoreUser)
  .get(authorizeRoles(roles.OWNER), storeController.getAllStoreUsers);
router.route('/users/:id').delete(authorizeRoles(roles.OWNER), storeController.deleteStoreUserById);

router.route('/all').get(authorizeRoles('super-admin'), storeController.getAllStoresWithSubscription);

export default router;
