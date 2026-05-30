import express from 'express';
import {
  assignNumberToUser,
  buyNumber,
  importOwnedNumbers,
  listOwnedNumbers,
  searchAvailableNumbers
} from '../controller/phoneNumberController.js';
import { requireAdmin } from '../controller/authController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware, requireAdmin);

router.get('/', listOwnedNumbers);
router.post('/import', importOwnedNumbers);
router.get('/available', searchAvailableNumbers);
router.post('/buy', buyNumber);
router.patch('/:id/assign', assignNumberToUser);

export default router;
