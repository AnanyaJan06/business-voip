import express from 'express';
import { register, login , getCurrentUser, changePassword, requireAdmin } from '../controller/authController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', authMiddleware, requireAdmin, register);
router.post('/login', login);

router.get('/me', authMiddleware, getCurrentUser);
router.post('/change-password', authMiddleware, changePassword);


export default router;
