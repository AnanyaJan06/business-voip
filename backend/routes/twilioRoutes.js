import express from 'express';
import { getToken, makeCall, voiceResponse } from '../controller/twilioController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// Token for Browser Softphone (Important)
router.get('/token', authMiddleware, getToken);

// Make outbound call
router.post('/make-call', authMiddleware, makeCall);

// Twilio Webhook (TwiML)
router.post('/voice', voiceResponse);

export default router;