import express from 'express';
import {
  assignNumberToUser,
  listOwnedNumbers,
  syncPurchasedNumbers
} from '../controller/phoneNumberController.js';
import { requireAdmin } from '../controller/authController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware, requireAdmin);

router.get('/', listOwnedNumbers);
router.post('/import', syncPurchasedNumbers);
router.patch('/:id/assign', assignNumberToUser);

export default router;
