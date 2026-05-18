import express from 'express';
import { getMessages, receiveMessage, sendMessage } from '../controller/messageController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', authMiddleware, getMessages);
router.post('/send', authMiddleware, sendMessage);
router.post('/incoming', receiveMessage);

export default router;
