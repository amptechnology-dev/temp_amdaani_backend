import { Router } from 'express';
import * as roleController from '../controllers/role.controller.js';

const router = Router();

router.get('/', roleController.getRoles);

export default router;
