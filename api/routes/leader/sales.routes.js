import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireLeader } from '../../middleware/leader.js';
import { getSales } from '../../controllers/leader/sales.controller.js';

const router = express.Router();
router.use(requireAuth, requireLeader);

router.get('/', getSales);

export default router;