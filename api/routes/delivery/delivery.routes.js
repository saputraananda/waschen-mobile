import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  getSummary,
  getPickupList,
  getReadyList,
  searchDelivery
} from '../../controllers/delivery/delivery.controller.js';

const router = express.Router();

router.use(requireAuth);

router.get('/summary', getSummary);
router.get('/pickup', getPickupList);
router.get('/ready', getReadyList);
router.get('/search', searchDelivery);

export default router;
