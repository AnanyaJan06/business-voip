import express from 'express';
import { saveCallLog, getCallLogs } from '../controller/callController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/log', authMiddleware, saveCallLog);
router.get('/logs', authMiddleware, getCallLogs);

export default router;