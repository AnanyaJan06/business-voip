import express from 'express';
import { register, login , getCurrentUser, getUsers, changePassword, requireAdmin } from '../controller/authController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);

router.get('/me', authMiddleware, getCurrentUser);
router.get('/users', authMiddleware, requireAdmin, getUsers);
router.post('/change-password', authMiddleware, changePassword);


export default router;
