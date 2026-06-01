import { Router } from 'express';

import * as chatbotController from '../controllers/chatbot.controller.js';

import { authenticate, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = Router();

// Public Chat API
router.post('/chat', chatbotController.chat);

// Public FAQ List
router.get('/', chatbotController.getAllChatbots);

// Admin only
router.use(authenticate);
router.use(authorizeRoles('super-admin'));

router.post('/', chatbotController.createChatbot);

router
  .route('/:id')
  .get(chatbotController.getChatbotById)
  .put(chatbotController.updateChatbot)
  .delete(chatbotController.deleteChatbot);

export default router;
